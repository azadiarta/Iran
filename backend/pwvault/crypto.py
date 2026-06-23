"""
At-rest encryption for the superuser password vault (educational security-lab
feature — see backend/pwvault/models.py for the full picture).

Six independently-keyed, reversible layers are chained together: three
Fernet (AES-128-CBC + HMAC-SHA256) layers, plus two classical "rotating
cipher" layers (a Vigenere-style substitution whose effective key rotates
every cycle, and an HMAC-chained keystream whose blocks never repeat) and one
keyed byte-transposition layer. This raises the bar for a student trying to
recover a password, but it is NOT a real security boundary: every layer key
is derived (PBKDF2HMAC, per-layer salt) from the single PWVAULT_SECRET_KEY,
so this is depth-for-the-sake-of-the-exercise, not independent secrets.
"""
import hashlib
import hmac
import random
from base64 import urlsafe_b64encode
from functools import lru_cache

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from django.conf import settings

_PBKDF2_ITERATIONS = 200_000
_BLOCK_SIZE = 16  # bytes — used by the layer-5 transposition cipher
_VERSION_PREFIX = 'pv6:'


@lru_cache(maxsize=None)
def _derive_key(salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=_PBKDF2_ITERATIONS)
    return kdf.derive(settings.PWVAULT_SECRET_KEY.encode('utf-8'))


def _key(layer: int) -> bytes:
    return _derive_key(f'pwvault-layer-{layer}'.encode('utf-8'))


@lru_cache(maxsize=None)
def _fernet(layer: int) -> Fernet:
    return Fernet(urlsafe_b64encode(_key(layer)))


# ─── Layer 1 — rotating substitution (Vigenere, but the key itself rotates) ──
def _rotl8(byte: int, n: int) -> int:
    n %= 8
    return ((byte << n) | (byte >> (8 - n))) & 0xFF


def _rotating_substitution(data: bytes, key: bytes, encrypt: bool) -> bytes:
    out = bytearray(len(data))
    klen = len(key)
    for i, b in enumerate(data):
        rotation = (i // klen) % 8
        ks = _rotl8(key[i % klen], rotation)
        out[i] = (b + ks) % 256 if encrypt else (b - ks) % 256
    return bytes(out)


# ─── Layer 3 — HMAC-chained rotating keystream (stream cipher), XOR-applied ──
def _hmac_keystream(key: bytes, length: int) -> bytes:
    blocks = []
    produced = 0
    counter = 0
    while produced < length:
        block = hmac.new(key, counter.to_bytes(4, 'big'), hashlib.sha256).digest()
        blocks.append(block)
        produced += len(block)
        counter += 1
    return b''.join(blocks)[:length]


def _xor_keystream(data: bytes, key: bytes) -> bytes:
    keystream = _hmac_keystream(key, len(data))
    return bytes(a ^ b for a, b in zip(data, keystream))


# ─── Layer 5 — keyed block transposition ─────────────────────────────────────
def _block_permutation(key: bytes) -> list:
    # A dedicated random.Random instance (NOT the shared `random` module) so
    # this never shares PRNG state with Member._generate_member_number().
    seed = int.from_bytes(key[:8], 'big')
    perm = list(range(_BLOCK_SIZE))
    random.Random(seed).shuffle(perm)
    return perm


def _layer5_transpose(data: bytes, key: bytes) -> bytes:
    padder = padding.PKCS7(_BLOCK_SIZE * 8).padder()
    padded = padder.update(data) + padder.finalize()
    perm = _block_permutation(key)
    out = bytearray(len(padded))
    for start in range(0, len(padded), _BLOCK_SIZE):
        block = padded[start:start + _BLOCK_SIZE]
        for src, dst in enumerate(perm):
            out[start + dst] = block[src]
    return bytes(out)


def _layer5_untranspose(data: bytes, key: bytes) -> bytes:
    perm = _block_permutation(key)
    out = bytearray(len(data))
    for start in range(0, len(data), _BLOCK_SIZE):
        block = data[start:start + _BLOCK_SIZE]
        for src, dst in enumerate(perm):
            out[start + src] = block[dst]
    unpadder = padding.PKCS7(_BLOCK_SIZE * 8).unpadder()
    return unpadder.update(bytes(out)) + unpadder.finalize()


def encrypt_password(raw: str) -> str:
    b = raw.encode('utf-8')
    b = _rotating_substitution(b, _key(1), encrypt=True)
    b = _fernet(2).encrypt(b)
    b = _xor_keystream(b, _key(3))
    b = _fernet(4).encrypt(b)
    b = _layer5_transpose(b, _key(5))
    b = _fernet(6).encrypt(b)
    return _VERSION_PREFIX + b.decode('ascii')


def decrypt_password(token: str) -> str:
    if not token.startswith(_VERSION_PREFIX):
        raise ValueError('Unsupported vault ciphertext version.')
    b = token[len(_VERSION_PREFIX):].encode('ascii')
    b = _fernet(6).decrypt(b)
    b = _layer5_untranspose(b, _key(5))
    b = _fernet(4).decrypt(b)
    b = _xor_keystream(b, _key(3))
    b = _fernet(2).decrypt(b)
    b = _rotating_substitution(b, _key(1), encrypt=False)
    return b.decode('utf-8')
