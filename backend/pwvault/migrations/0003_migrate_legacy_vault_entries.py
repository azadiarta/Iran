# Carries forward any pre-existing PasswordVaultEntry row (single-entry,
# 6-layer-Fernet ciphertext, the original revision of this feature) into the
# new append-only PasswordVaultHistory table as that member's sequence=0
# entry, using the envelope-encryption scheme that was current at the time
# this migration was written: key_version=2 (fixed global per-layer
# classical salts, single AES-256-GCM-wrapped DEK, single env-sourced root
# secret -- see pwvault/crypto.py's module docstring for how key_version 3+
# differs).
#
# Deliberately self-contained: every primitive below is a frozen, inlined
# copy, NOT an import from pwvault.crypto. Data migrations must never call
# into live application code -- crypto.py's "current" key version (and the
# secrets/tables it depends on, e.g. the key_version>=3 database-only pepper
# added by a later migration) is expected to keep changing over this
# project's life, and this migration must keep producing exactly the bytes
# it always has, independent of any of that. A row that fails to decrypt
# (e.g. PWVAULT_SECRET_KEY already rotated) is skipped rather than aborting
# the whole migration -- this app has no backfill guarantee for passwords
# set before this feature existed in the first place, so losing one
# already-unrecoverable legacy row here is not a regression.
import hashlib
import hmac
import os
import random
from base64 import b64decode, b64encode, urlsafe_b64encode

from argon2.low_level import Type, hash_secret_raw
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM, ChaCha20Poly1305
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from django.conf import settings
from django.db import migrations

_KEY_VERSION = 2
_AESGCM_NONCE_SIZE = 12
_CLASSICAL_PBKDF2_ITERATIONS = 200_000
_CLASSICAL_BLOCK_SIZE = 16
_CLASSICAL_VERSION_PREFIX = 'pv6:'


def _b64(data: bytes) -> str:
    return b64encode(data).decode('ascii')


def _unb64(data: str) -> bytes:
    return b64decode(data.encode('ascii'))


def _classical_derive_key(salt: bytes, secret: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=_CLASSICAL_PBKDF2_ITERATIONS)
    return kdf.derive(secret)


def _classical_key(layer: int, secret: bytes) -> bytes:
    return _classical_derive_key(f'pwvault-layer-{layer}'.encode('utf-8'), secret)


def _classical_fernet(layer: int, secret: bytes) -> Fernet:
    return Fernet(urlsafe_b64encode(_classical_key(layer, secret)))


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


def _block_permutation(key: bytes) -> list:
    seed = int.from_bytes(key[:8], 'big')
    perm = list(range(_CLASSICAL_BLOCK_SIZE))
    random.Random(seed).shuffle(perm)
    return perm


def _transpose(data: bytes, key: bytes) -> bytes:
    padder = padding.PKCS7(_CLASSICAL_BLOCK_SIZE * 8).padder()
    padded = padder.update(data) + padder.finalize()
    perm = _block_permutation(key)
    out = bytearray(len(padded))
    for start in range(0, len(padded), _CLASSICAL_BLOCK_SIZE):
        block = padded[start:start + _CLASSICAL_BLOCK_SIZE]
        for src, dst in enumerate(perm):
            out[start + dst] = block[src]
    return bytes(out)


def _untranspose(data: bytes, key: bytes) -> bytes:
    perm = _block_permutation(key)
    out = bytearray(len(data))
    for start in range(0, len(data), _CLASSICAL_BLOCK_SIZE):
        block = data[start:start + _CLASSICAL_BLOCK_SIZE]
        for src, dst in enumerate(perm):
            out[start + src] = block[dst]
    unpadder = padding.PKCS7(_CLASSICAL_BLOCK_SIZE * 8).unpadder()
    return unpadder.update(bytes(out)) + unpadder.finalize()


def _classical_encrypt(data: bytes, secret: bytes) -> bytes:
    b = _rotating_substitution(data, _classical_key(1, secret), encrypt=True)
    b = _classical_fernet(2, secret).encrypt(b)
    b = _xor_keystream(b, _classical_key(3, secret))
    b = _classical_fernet(4, secret).encrypt(b)
    b = _transpose(b, _classical_key(5, secret))
    b = _classical_fernet(6, secret).encrypt(b)
    return b


def _classical_decrypt(data: bytes, secret: bytes) -> bytes:
    b = _classical_fernet(6, secret).decrypt(data)
    b = _untranspose(b, _classical_key(5, secret))
    b = _classical_fernet(4, secret).decrypt(b)
    b = _xor_keystream(b, _classical_key(3, secret))
    b = _classical_fernet(2, secret).decrypt(b)
    b = _rotating_substitution(b, _classical_key(1, secret), encrypt=False)
    return b


def _decrypt_legacy_v6(token: str, secret: bytes) -> str:
    if not token.startswith(_CLASSICAL_VERSION_PREFIX):
        raise ValueError('Unsupported legacy vault ciphertext version.')
    b = token[len(_CLASSICAL_VERSION_PREFIX):].encode('ascii')
    return _classical_decrypt(b, secret).decode('utf-8')


def _root_secret(secret: bytes) -> bytes:
    salt = hashlib.sha256(f'pwvault-root-v{_KEY_VERSION}'.encode('utf-8')).digest()[:16]
    return hash_secret_raw(
        secret=secret, salt=salt, time_cost=3, memory_cost=64 * 1024, parallelism=4, hash_len=32, type=Type.ID,
    )


def _hkdf(key_material: bytes, info: bytes, length: int = 32) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=length, salt=None, info=info).derive(key_material)


def _kek(secret: bytes) -> bytes:
    return _hkdf(_root_secret(secret), b'pwvault-kek')


def _integrity_key(secret: bytes) -> bytes:
    return _hkdf(_root_secret(secret), b'pwvault-integrity')


def _payload_keys(dek: bytes) -> tuple:
    return _hkdf(dek, b'pwvault-payload-layer-1'), _hkdf(dek, b'pwvault-payload-layer-2')


def _entry_aad(member_id, sequence: int) -> bytes:
    return f'{member_id}:{sequence}:{_KEY_VERSION}'.encode('utf-8')


def _compute_chain_hash(prev_chain_hash, member_id, sequence: int, dek_ciphertext: bytes,
                         payload_ciphertext: bytes, secret: bytes) -> str:
    mac = hmac.new(_integrity_key(secret), digestmod=hashlib.sha256)
    mac.update((prev_chain_hash or '').encode('utf-8'))
    mac.update(b'|')
    mac.update(str(member_id).encode('utf-8'))
    mac.update(b'|')
    mac.update(str(sequence).encode('utf-8'))
    mac.update(b'|')
    mac.update(dek_ciphertext)
    mac.update(b'|')
    mac.update(payload_ciphertext)
    return mac.hexdigest()


def _encrypt_password_entry(raw: str, member_id, sequence: int, prev_chain_hash, secret: bytes) -> dict:
    aad = _entry_aad(member_id, sequence)
    payload = _classical_encrypt(raw.encode('utf-8'), secret)

    dek = os.urandom(32)
    key1, key2 = _payload_keys(dek)

    nonce1 = os.urandom(_AESGCM_NONCE_SIZE)
    ct1 = AESGCM(key1).encrypt(nonce1, payload, aad)

    nonce2 = os.urandom(_AESGCM_NONCE_SIZE)
    ct2 = ChaCha20Poly1305(key2).encrypt(nonce2, ct1, aad)

    dek_nonce = os.urandom(_AESGCM_NONCE_SIZE)
    dek_ciphertext = AESGCM(_kek(secret)).encrypt(dek_nonce, dek, aad)

    chain_hash = _compute_chain_hash(prev_chain_hash, member_id, sequence, dek_ciphertext, ct2, secret)

    return {
        'key_version': _KEY_VERSION,
        'dek_envelope': {'nonce': _b64(dek_nonce), 'ciphertext': _b64(dek_ciphertext)},
        'ciphertext_layers': {'nonce1': _b64(nonce1), 'nonce2': _b64(nonce2), 'ciphertext': _b64(ct2)},
        'chain_hash': chain_hash,
        'prev_chain_hash': prev_chain_hash or '',
    }


def migrate_legacy_entries(apps, schema_editor):
    PasswordVaultEntry = apps.get_model('pwvault', 'PasswordVaultEntry')
    PasswordVaultHistory = apps.get_model('pwvault', 'PasswordVaultHistory')
    secret = settings.PWVAULT_SECRET_KEY.encode('utf-8')

    for entry in PasswordVaultEntry.objects.all():
        try:
            raw_password = _decrypt_legacy_v6(entry.ciphertext, secret)
        except Exception:
            continue
        fields = _encrypt_password_entry(raw_password, entry.member_id, sequence=0, prev_chain_hash=None, secret=secret)
        PasswordVaultHistory.objects.create(member_id=entry.member_id, sequence=0, **fields)


def noop_reverse(apps, schema_editor):
    # Irreversible by design (the old table is gone by the time anyone would
    # roll back past this point) -- nothing useful to undo here.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('pwvault', '0002_passwordvaulthistory'),
    ]

    operations = [
        migrations.RunPython(migrate_legacy_entries, noop_reverse),
    ]
