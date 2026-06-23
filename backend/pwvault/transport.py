"""
In-transit encryption for the password-vault API response (on top of the
at-rest layers in pwvault/crypto.py — see that module's docstring for
context). Wraps the plaintext password in two nested AES-256-GCM layers
before it ever leaves the server; the matching decrypt runs as real WebCrypto
(crypto.subtle) in the superuser's browser — see frontend/lib/vaultCrypto.ts.

Both AES-GCM keys are derived (HKDF-SHA256) from the raw JWT access token
that authenticated this very request — a secret only the legitimate,
logged-in superuser's browser and this server ever see, and one that is
never itself transmitted alongside the ciphertext. A fresh random salt is
generated per response, so the derived keys are effectively "rotating": no
two reveals ever use the same key, even for the same member/session.
"""
import base64
import os

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


def _derive_transport_key(token_bytes: bytes, salt: bytes, info: bytes) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=info).derive(token_bytes)


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode('ascii')


def encrypt_for_transport(plaintext: str, token_bytes: bytes) -> dict:
    salt1, nonce1 = os.urandom(16), os.urandom(12)
    key1 = _derive_transport_key(token_bytes, salt1, b'pwvault-transport-1')
    ct1 = AESGCM(key1).encrypt(nonce1, plaintext.encode('utf-8'), None)

    salt2, nonce2 = os.urandom(16), os.urandom(12)
    key2 = _derive_transport_key(token_bytes, salt2, b'pwvault-transport-2')
    ct2 = AESGCM(key2).encrypt(nonce2, ct1, None)

    return {
        'salt1': _b64(salt1), 'nonce1': _b64(nonce1),
        'salt2': _b64(salt2), 'nonce2': _b64(nonce2),
        'ciphertext': _b64(ct2),
    }
