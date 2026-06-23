"""
In-transit encryption for the password-vault API response (on top of the
at-rest layers in pwvault/crypto.py -- see that module's docstring for the
matching at-rest combination; this module follows the same pattern).

Two independent constructions are layered together, strongest/newest
outermost:

  1. Token-bound layer (innermost; this module's original construction):
     two nested AES-256-GCM layers whose keys are HKDF-derived from the raw
     JWT access token that authenticated this very request -- a secret only
     the legitimate, logged-in superuser's browser and this server ever
     see, and one that is never itself transmitted alongside the
     ciphertext. A fresh random salt per layer, per entry, means these
     derived keys never repeat.

  2. End-to-end ECDH layer (outermost; this module's current construction):
     for every reveal, the superuser's browser generates a fresh, single-use
     P-256 ECDH keypair entirely client-side (frontend/lib/vaultCrypto.ts)
     and sends only the PUBLIC half to the server as a query parameter
     (`?epk=`). The server generates its OWN fresh single-use P-256
     keypair, runs Elliptic Curve Diffie-Hellman against the client's
     public key, and HKDF-derives two more independent AES-256-GCM keys
     from the resulting shared secret. That shared secret exists nowhere
     except inside this one exchange and both ephemeral private keys are
     discarded the moment the request finishes -- Perfect Forward Secrecy:
     even a full future compromise of PWVAULT_SECRET_KEY or the JWT signing
     key cannot decrypt a reveal that already happened.

A captured response is therefore protected by both secrets at once: peeling
off layer 2 requires solving the ECDH discrete-log problem (or holding the
browser's one-time ephemeral private key, which never leaves `window`
memory), and what's left after that is still opaque without the exact JWT
that authenticated the original request.

Every AEAD operation in both layers is additionally bound (AAD) to the
exact member id it was encrypted for, so a captured envelope cannot be
replayed as if it belonged to a different member's reveal.
"""
import base64
import os

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

_CURVE = ec.SECP256R1()
_AESGCM_NONCE_SIZE = 12
_HKDF_SALT_SIZE = 16


class InvalidClientKey(ValueError):
    """Raised when the client-supplied ephemeral public key is malformed."""


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode('ascii')


def _unb64(data: str) -> bytes:
    return base64.b64decode(data.encode('ascii'))


def parse_client_public_key(epk_b64: str) -> ec.EllipticCurvePublicKey:
    """`epk_b64` is the browser's ephemeral P-256 public key, raw uncompressed
    point (WebCrypto 'raw' export format), base64-encoded."""
    try:
        raw = _unb64(epk_b64)
        return ec.EllipticCurvePublicKey.from_encoded_point(_CURVE, raw)
    except Exception as exc:
        raise InvalidClientKey('Invalid or malformed ephemeral public key.') from exc


def _derive_key(secret: bytes, salt: bytes, info: bytes) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=info).derive(secret)


# ─── Layer 1 (innermost) — JWT-token-bound double AES-256-GCM ───────────────
def _token_wrap(plaintext: bytes, token_bytes: bytes, aad: bytes) -> tuple:
    salt1, nonce1 = os.urandom(_HKDF_SALT_SIZE), os.urandom(_AESGCM_NONCE_SIZE)
    key1 = _derive_key(token_bytes, salt1, b'pwvault-transport-jwt-1')
    ct1 = AESGCM(key1).encrypt(nonce1, plaintext, aad)

    salt2, nonce2 = os.urandom(_HKDF_SALT_SIZE), os.urandom(_AESGCM_NONCE_SIZE)
    key2 = _derive_key(token_bytes, salt2, b'pwvault-transport-jwt-2')
    ct2 = AESGCM(key2).encrypt(nonce2, ct1, aad)

    fields = {
        'jwt_salt1': _b64(salt1), 'jwt_nonce1': _b64(nonce1),
        'jwt_salt2': _b64(salt2), 'jwt_nonce2': _b64(nonce2),
    }
    return ct2, fields


# ─── Layer 2 (outermost) — ephemeral ECDH double AES-256-GCM (E2E, PFS) ─────
def encrypt_many_for_transport_e2e(plaintexts, client_public_key: ec.EllipticCurvePublicKey,
                                    member_id, token_bytes: bytes) -> dict:
    """One fresh ephemeral ECDH exchange shared across every entry in
    `plaintexts` (a list of str) -- like a single TLS session protecting
    several records sent together (e.g. a whole password history). Each
    entry still gets its own unique token-layer salts/nonces AND its own
    unique ECDH-layer nonces, so no AEAD key/nonce pair is ever reused."""
    server_ephemeral = ec.generate_private_key(_CURVE)
    shared_secret = server_ephemeral.exchange(ec.ECDH(), client_public_key)

    salt = os.urandom(_HKDF_SALT_SIZE)
    aad = str(member_id).encode('utf-8')
    aead1 = AESGCM(_derive_key(shared_secret, salt, b'pwvault-e2e-layer-1'))
    aead2 = AESGCM(_derive_key(shared_secret, salt, b'pwvault-e2e-layer-2'))

    envelopes = []
    for plaintext in plaintexts:
        token_wrapped, jwt_fields = _token_wrap(plaintext.encode('utf-8'), token_bytes, aad)

        nonce1, nonce2 = os.urandom(_AESGCM_NONCE_SIZE), os.urandom(_AESGCM_NONCE_SIZE)
        ct1 = aead1.encrypt(nonce1, token_wrapped, aad)
        ct2 = aead2.encrypt(nonce2, ct1, aad)
        envelopes.append({
            **jwt_fields,
            'nonce1': _b64(nonce1), 'nonce2': _b64(nonce2), 'ciphertext': _b64(ct2),
        })

    server_epk_raw = server_ephemeral.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    return {'server_epk': _b64(server_epk_raw), 'salt': _b64(salt), 'envelopes': envelopes}


def encrypt_for_transport_e2e(plaintext: str, client_public_key: ec.EllipticCurvePublicKey,
                               member_id, token_bytes: bytes) -> dict:
    result = encrypt_many_for_transport_e2e([plaintext], client_public_key, member_id, token_bytes)
    envelope = result['envelopes'][0]
    return {'server_epk': result['server_epk'], 'salt': result['salt'], **envelope}
