"""
In-transit encryption for the password-vault API response (on top of the
at-rest layers in pwvault/crypto.py -- see that module's docstring for the
matching at-rest combination; this module follows the same pattern: every
secret a layer depends on is independent of every other layer's secret, and
every record gets its own derived key, never a key shared verbatim with any
other record or any other layer).

Three independent constructions are layered together, strongest/newest
outermost:

  1. Token-bound layer (innermost): two nested AES-256-GCM layers whose keys
     are HKDF-derived from the raw JWT access token that authenticated this
     very request -- a secret only the legitimate, logged-in superuser's
     browser and this server ever see, and one that is never itself
     transmitted alongside the ciphertext. A fresh random HKDF salt AND a
     fresh AEAD nonce, per layer, per entry, means these derived keys never
     repeat -- not even between two entries of the same history response.

  2. End-to-end ECDH layer (middle): for every reveal, the superuser's
     browser generates a fresh, single-use P-256 ECDH keypair entirely
     client-side (frontend/lib/vaultCrypto.ts) and sends only the PUBLIC
     half to the server as a query parameter (`?epk=`). The server generates
     its OWN fresh single-use P-256 keypair, runs Elliptic Curve
     Diffie-Hellman against the client's public key, and HKDF-derives two
     more independent AES-256-GCM keys from the resulting shared secret --
     PER ENTRY: the HKDF `info` label is suffixed with that entry's index,
     so a multi-entry history reveal never reuses one entry's key for
     another's, even though every entry in one response shares the same
     underlying ECDH exchange (one exchange, many independently-derived
     keys -- the same key-separation principle HKDF labels exist for). The
     label is each entry's own stable id (e.g. its history row `sequence`),
     never its position in the list being encrypted -- positions shift when
     undecryptable rows are filtered out or the list is reordered for
     display, a stable id does not. That
     shared secret exists nowhere except inside this one exchange, and both
     ephemeral private keys are discarded the moment the request finishes:
     Perfect Forward Secrecy -- even a full future compromise of
     PWVAULT_SECRET_KEY or the JWT signing key cannot decrypt a reveal that
     already happened.

  3. Post-quantum ML-KEM-768 layer (outermost, current addition): plain
     ECDH's security rests on the elliptic-curve discrete-log problem, which
     a sufficiently large quantum computer (running Shor's algorithm) breaks
     outright -- AES-256/ChaCha20-Poly1305 are not meaningfully threatened by
     any realistic adversary, classical or quantum (Grover's algorithm only
     halves their effective key length, 256->~128 bits, still infeasible),
     but layer 2's key-EXCHANGE step would not survive "harvest now, decrypt
     later": an adversary who records today's ciphertext and ECDH public
     keys could decrypt them once a capable enough quantum computer exists.
     To close exactly that gap, the browser ALSO generates a fresh, single-
     use ML-KEM-768 keypair (FIPS 203, the NIST-standardized post-quantum
     key-encapsulation mechanism; frontend uses @noble/post-quantum, backend
     uses cryptography's native, OpenSSL-backed `mlkem` module -- both
     implementations are interoperable, lattice-based, and currently
     considered secure against both classical AND quantum cryptanalysis) and
     sends its public key as `?kem_pk=`. The server encapsulates against it,
     and HKDF-derives a third, fully independent set of per-entry
     ChaCha20-Poly1305 keys from the resulting shared secret, applied as the
     final, outermost encryption pass. The KEM ciphertext is safe to send
     back in the clear (it is not the secret -- only the holder of the
     matching ML-KEM private key, which never leaves the browser, can
     decapsulate it), the same way an ECDH public key is safe to send.

A captured response must therefore survive breaking THREE independent hard
problems at once, each from a different mathematical family, to recover
anything: a lattice problem (ML-KEM), the elliptic-curve discrete-log
problem (ECDH) -- or holding either ephemeral private key, neither of which
ever leaves the browser's memory -- and, even after both of those, still
needs the exact JWT that authenticated the original request. A future
quantum break of ECDH alone (layer 2) leaves layers 1 and 3 fully intact;
each layer's compromise is independent of the others', by construction, not
by accident.

Every AEAD operation in every layer is additionally bound (AAD) to the exact
member id it was encrypted for, so a captured envelope cannot be replayed as
if it belonged to a different member's reveal.

A fourth, final construction sits on top of all three AEAD layers above:
a plain, *unencrypted* HMAC-SHA256 tag (`replay_tag`) over the entire
envelope -- every salt, every public value, every entry's final ciphertext,
and an `issued_at` timestamp -- keyed via HKDF from the same JWT-token
secret as layer 1. This is deliberately one-way (a MAC, not another
encryption pass): its only job is to let the browser recompute the exact
same tag from the cleartext envelope fields it already received and refuse
to even attempt decryption if they don't match bit-for-bit, which catches
two things AEAD alone does not: a response whose *outer* fields (e.g.
`server_epk`, or one entry's ciphertext spliced from a different, older
response) were swapped wholesale rather than bit-flipped, and -- via
`issued_at` -- a captured-and-replayed response served stale well after the
original request. Forging a valid tag without the JWT token is exactly as
hard as forging layer 1 itself.
"""
import base64
import hashlib
import hmac
import os
import time

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, mlkem
from cryptography.hazmat.primitives.ciphers.aead import AESGCM, ChaCha20Poly1305
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

_CURVE = ec.SECP256R1()
_AESGCM_NONCE_SIZE = 12
_HKDF_SALT_SIZE = 16


class InvalidClientKey(ValueError):
    """Raised when a client-supplied ephemeral public key (ECDH or ML-KEM) is malformed."""


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


def parse_client_kem_public_key(kem_pk_b64: str) -> mlkem.MLKEM768PublicKey:
    """`kem_pk_b64` is the browser's ephemeral ML-KEM-768 public key (raw FIPS
    203 encoding, base64), generated fresh per reveal by @noble/post-quantum."""
    try:
        raw = _unb64(kem_pk_b64)
        return mlkem.MLKEM768PublicKey.from_public_bytes(raw)
    except Exception as exc:
        raise InvalidClientKey('Invalid or malformed ML-KEM-768 public key.') from exc


def _derive_key(secret: bytes, salt: bytes, info: bytes) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=info).derive(secret)


# ─── Outermost integrity tag — keyed HMAC over the whole envelope ───────────
def _compute_replay_tag(token_bytes: bytes, issued_at: str, server_epk_b64: str, salt_b64: str,
                         pq_ciphertext_b64: str, pq_salt_b64: str, ordered_ciphertexts: list) -> tuple:
    """`ordered_ciphertexts` must already be sorted by each entry's own
    stable id (never list position) -- the caller and the browser
    (frontend/lib/vaultCrypto.ts) both sort by that same id before joining,
    so the canonical string is identical on both ends regardless of any
    display-only reordering applied elsewhere. Plain `'|'`/`','`-joined
    string concatenation (not JSON) sidesteps any risk of Python's and
    JavaScript's serializers ever disagreeing on field order or escaping."""
    replay_salt = os.urandom(_HKDF_SALT_SIZE)
    replay_key = _derive_key(token_bytes, replay_salt, b'pwvault-transport-replay-integrity')
    canonical = '|'.join([
        issued_at, server_epk_b64, salt_b64, pq_ciphertext_b64, pq_salt_b64,
        ','.join(ordered_ciphertexts),
    ])
    tag = hmac.new(replay_key, canonical.encode('ascii'), hashlib.sha256).digest()
    return _b64(replay_salt), _b64(tag)


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


# ─── Layers 2 & 3 (middle: ECDH: outermost: ML-KEM-768) ──────────────────────
def encrypt_many_for_transport_e2e(entries, client_public_key: ec.EllipticCurvePublicKey,
                                    client_kem_public_key: mlkem.MLKEM768PublicKey,
                                    member_id, token_bytes: bytes) -> dict:
    """One fresh ephemeral ECDH exchange AND one fresh ephemeral ML-KEM-768
    encapsulation, both shared across every entry in `entries` (a list of
    `(entry_id, plaintext)` pairs) -- like a single TLS session protecting
    several records sent together (e.g. a whole password history). Despite
    sharing those two session-level secrets, every entry still gets its own
    unique token-layer salts/nonces (layer 1) AND its own independently-
    HKDF-derived layer-2/layer-3 keys (each entry's OWN stable `entry_id` --
    e.g. a PasswordVaultHistory row's `sequence`, never its position in this
    particular list -- is folded into each HKDF `info` label). Using the
    caller-supplied id rather than list position matters: history rows that
    fail to decrypt are filtered out before this function ever sees them,
    and the caller reverses the list afterwards for newest-first display --
    either operation would silently shift positional indices and could
    derive the wrong key for a given row. A stable id keeps every entry's
    derived keys tied to that one entry, however the list is filtered or
    reordered around it, so no AEAD key/nonce pair is ever reused, even
    within one response."""
    server_ephemeral = ec.generate_private_key(_CURVE)
    ecdh_secret = server_ephemeral.exchange(ec.ECDH(), client_public_key)

    pq_secret, pq_ciphertext = client_kem_public_key.encapsulate()

    ecdh_salt = os.urandom(_HKDF_SALT_SIZE)
    pq_salt = os.urandom(_HKDF_SALT_SIZE)
    aad = str(member_id).encode('utf-8')

    envelopes = []
    ciphertexts_by_id = []
    for entry_id, plaintext in entries:
        token_wrapped, jwt_fields = _token_wrap(plaintext.encode('utf-8'), token_bytes, aad)
        entry_tag = str(entry_id).encode('utf-8')

        # layer 2 — ECDH-derived, per-entry-diversified
        key1 = _derive_key(ecdh_secret, ecdh_salt, b'pwvault-e2e-layer-1:' + entry_tag)
        key2 = _derive_key(ecdh_secret, ecdh_salt, b'pwvault-e2e-layer-2:' + entry_tag)
        nonce1, nonce2 = os.urandom(_AESGCM_NONCE_SIZE), os.urandom(_AESGCM_NONCE_SIZE)
        ct1 = AESGCM(key1).encrypt(nonce1, token_wrapped, aad)
        ct2 = AESGCM(key2).encrypt(nonce2, ct1, aad)

        # layer 3 (outermost) — ML-KEM-768-derived, per-entry-diversified,
        # a different AEAD family (ChaCha20-Poly1305) than layer 2's AES-GCM
        pq_key = _derive_key(pq_secret, pq_salt, b'pwvault-pq-layer-3:' + entry_tag)
        pq_nonce = os.urandom(_AESGCM_NONCE_SIZE)
        ct3 = ChaCha20Poly1305(pq_key).encrypt(pq_nonce, ct2, aad)
        ct3_b64 = _b64(ct3)

        envelopes.append({
            **jwt_fields,
            'nonce1': _b64(nonce1), 'nonce2': _b64(nonce2),
            'pq_nonce': _b64(pq_nonce),
            'ciphertext': ct3_b64,
        })
        ciphertexts_by_id.append((entry_id, ct3_b64))

    server_epk_raw = server_ephemeral.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    server_epk_b64, ecdh_salt_b64 = _b64(server_epk_raw), _b64(ecdh_salt)
    pq_ciphertext_b64, pq_salt_b64 = _b64(pq_ciphertext), _b64(pq_salt)
    issued_at = str(int(time.time()))
    ordered_ciphertexts = [ct for _entry_id, ct in sorted(ciphertexts_by_id, key=lambda pair: pair[0])]
    replay_salt_b64, replay_tag_b64 = _compute_replay_tag(
        token_bytes, issued_at, server_epk_b64, ecdh_salt_b64, pq_ciphertext_b64, pq_salt_b64, ordered_ciphertexts,
    )
    return {
        'server_epk': server_epk_b64, 'salt': ecdh_salt_b64,
        'pq_ciphertext': pq_ciphertext_b64, 'pq_salt': pq_salt_b64,
        'issued_at': issued_at, 'replay_salt': replay_salt_b64, 'replay_tag': replay_tag_b64,
        'envelopes': envelopes,
    }


def encrypt_for_transport_e2e(plaintext: str, client_public_key: ec.EllipticCurvePublicKey,
                               client_kem_public_key: mlkem.MLKEM768PublicKey,
                               member_id, token_bytes: bytes) -> dict:
    result = encrypt_many_for_transport_e2e(
        [(0, plaintext)], client_public_key, client_kem_public_key, member_id, token_bytes,
    )
    envelope = result['envelopes'][0]
    return {
        'server_epk': result['server_epk'], 'salt': result['salt'],
        'pq_ciphertext': result['pq_ciphertext'], 'pq_salt': result['pq_salt'],
        'issued_at': result['issued_at'], 'replay_salt': result['replay_salt'], 'replay_tag': result['replay_tag'],
        **envelope,
    }
