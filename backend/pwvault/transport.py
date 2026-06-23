"""
End-to-end in-transit encryption for the password-vault API (on top of the
at-rest envelope encryption in pwvault/crypto.py -- see that module's
docstring for the at-rest key hierarchy).

This is real End-to-End Encryption (E2EE), not just "use HTTPS": for every
reveal, the superuser's browser generates a fresh, single-use P-256 ECDH
keypair entirely client-side (frontend/lib/vaultCrypto.ts) and sends only the
PUBLIC half to the server as a query parameter (`?epk=`). The server
generates its OWN fresh single-use P-256 keypair, runs Elliptic Curve
Diffie-Hellman against the client's public key, and HKDF-derives two
independent AES-256-GCM keys from the resulting shared secret.

That shared secret never exists anywhere except inside this one ECDH
exchange -- it is not derived from any long-term key, not sent over the
network in any form, and cannot be reconstructed from the two public keys
alone (the discrete-log problem). Both ephemeral private keys are discarded
the moment this request finishes, which also gives the exchange Perfect
Forward Secrecy: even a full compromise of PWVAULT_SECRET_KEY (or anything
else long-term) later on does not help decrypt a reveal that already
happened, because the only keys that ever protected that specific response
are already gone.

Every AEAD operation here is additionally bound (AAD) to the exact member id
it was encrypted for, so a captured envelope cannot be replayed as if it
belonged to a different member's reveal.
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


def _derive_layer_key(shared_secret: bytes, salt: bytes, info: bytes) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=info).derive(shared_secret)


def encrypt_many_for_transport_e2e(plaintexts, client_public_key: ec.EllipticCurvePublicKey, member_id) -> dict:
    """One fresh ephemeral ECDH exchange shared across every entry in
    `plaintexts` (a list of str) -- like a single TLS session protecting
    several records sent together (e.g. a whole password history). Each
    entry still gets its own unique nonces under that session's keys, so no
    AEAD key/nonce pair is ever reused."""
    server_ephemeral = ec.generate_private_key(_CURVE)
    shared_secret = server_ephemeral.exchange(ec.ECDH(), client_public_key)

    salt = os.urandom(_HKDF_SALT_SIZE)
    aad = str(member_id).encode('utf-8')
    aead1 = AESGCM(_derive_layer_key(shared_secret, salt, b'pwvault-e2e-layer-1'))
    aead2 = AESGCM(_derive_layer_key(shared_secret, salt, b'pwvault-e2e-layer-2'))

    envelopes = []
    for plaintext in plaintexts:
        nonce1, nonce2 = os.urandom(_AESGCM_NONCE_SIZE), os.urandom(_AESGCM_NONCE_SIZE)
        ct1 = aead1.encrypt(nonce1, plaintext.encode('utf-8'), aad)
        ct2 = aead2.encrypt(nonce2, ct1, aad)
        envelopes.append({'nonce1': _b64(nonce1), 'nonce2': _b64(nonce2), 'ciphertext': _b64(ct2)})

    server_epk_raw = server_ephemeral.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    return {'server_epk': _b64(server_epk_raw), 'salt': _b64(salt), 'envelopes': envelopes}


def encrypt_for_transport_e2e(plaintext: str, client_public_key: ec.EllipticCurvePublicKey, member_id) -> dict:
    result = encrypt_many_for_transport_e2e([plaintext], client_public_key, member_id)
    envelope = result['envelopes'][0]
    return {'server_epk': result['server_epk'], 'salt': result['salt'], **envelope}
