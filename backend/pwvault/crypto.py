"""
At-rest encryption for the superuser password vault's storage (see
backend/pwvault/models.py:PasswordVaultHistory and backend/pwvault/transport.py
for the in-transit/E2E half of the picture).

Two independent constructions are layered together, strongest/newest
outermost:

  1. Classical layer stack (innermost) -- this module's original six
     chained layers: three Fernet (AES-128-CBC + HMAC-SHA256) layers, plus
     two classical "rotating" constructions (a Vigenere-style substitution
     whose effective key itself rotates every cycle, and an HMAC-chained
     keystream whose blocks never repeat) and one keyed byte-transposition
     layer. Kept verbatim -- same functions, same per-layer PBKDF2-derived
     keys -- nothing here was thrown away; it is simply no longer the
     outermost or only boundary.

  2. Envelope encryption (outermost; KMS-style, e.g. AWS KMS/Vault "envelope
     encryption") wraps layer 1's output:
       PWVAULT_SECRET_KEY
         -> Argon2id (memory-hard, 64 MiB / t=3 / p=4 -- far costlier to
            brute-force off a leaked DB dump than the PBKDF2 layer 1 uses)
         -> root key material
         -> HKDF-SHA256, label-separated
            -> KEK (wraps every entry's one-time data-encryption key)
            -> integrity key (HMAC-chains the history for tamper-evidence)
     Every password gets its own randomly generated, single-use 256-bit DEK
     (wrapped under the KEK with AES-256-GCM -- the key gets the exact same
     cipher/size as the data it protects), and layer 1's ciphertext is then
     sealed under two more independently-keyed AEAD layers from two
     different cipher families (AES-256-GCM, then ChaCha20-Poly1305),
     derived from that DEK. Every AEAD operation is bound (AAD) to the exact
     member + history sequence + key version it belongs to, so a captured
     envelope can't be replayed onto a different row.

`PasswordVaultHistory.key_version` records which combination produced a
given row, so upgrading the format (like this revision did) never breaks
already-written history: `key_version=1` rows (written by this module's
previous revision -- envelope only, no layer-1 wrapping) keep decrypting
exactly as before; only new writes use `key_version=2` (layer 1 + envelope,
this revision). See decrypt_password_entry().

None of this is an industrial security claim -- layer 1's keys are all
ultimately derived from the very same PWVAULT_SECRET_KEY as layer 2's root
secret, just through a different KDF and different per-layer salts. The
goal is a deep, multi-technique educational challenge, not independent
real-world secrets.
"""
import hashlib
import hmac
import os
import random
from base64 import b64decode, b64encode, urlsafe_b64encode
from functools import lru_cache

from argon2.low_level import Type, hash_secret_raw
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM, ChaCha20Poly1305
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from django.conf import settings

_LEGACY_ENVELOPE_ONLY_VERSION = 1  # pre-existing rows: envelope wraps raw plaintext directly
_CURRENT_KEY_VERSION = 2  # classical layer stack (inner) + envelope (outer)
_AESGCM_NONCE_SIZE = 12
_CLASSICAL_PBKDF2_ITERATIONS = 200_000
_CLASSICAL_BLOCK_SIZE = 16  # bytes -- used by the keyed-transposition layer
_CLASSICAL_VERSION_PREFIX = 'pv6:'  # only read by decrypt_password_legacy_v6, see bottom of file


def _b64(data: bytes) -> str:
    return b64encode(data).decode('ascii')


def _unb64(data: str) -> bytes:
    return b64decode(data.encode('ascii'))


# ─── Layer 1 (innermost) — classical layer stack, unchanged since this
# module's first revision ─────────────────────────────────────────────────
@lru_cache(maxsize=None)
def _classical_derive_key(salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=_CLASSICAL_PBKDF2_ITERATIONS)
    return kdf.derive(settings.PWVAULT_SECRET_KEY.encode('utf-8'))


def _classical_key(layer: int) -> bytes:
    return _classical_derive_key(f'pwvault-layer-{layer}'.encode('utf-8'))


@lru_cache(maxsize=None)
def _classical_fernet(layer: int) -> Fernet:
    return Fernet(urlsafe_b64encode(_classical_key(layer)))


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
    # A dedicated random.Random instance (NOT the shared `random` module) so
    # this never shares PRNG state with Member._generate_member_number().
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


def _classical_encrypt(data: bytes) -> bytes:
    b = _rotating_substitution(data, _classical_key(1), encrypt=True)
    b = _classical_fernet(2).encrypt(b)
    b = _xor_keystream(b, _classical_key(3))
    b = _classical_fernet(4).encrypt(b)
    b = _transpose(b, _classical_key(5))
    b = _classical_fernet(6).encrypt(b)
    return b


def _classical_decrypt(data: bytes) -> bytes:
    b = _classical_fernet(6).decrypt(data)
    b = _untranspose(b, _classical_key(5))
    b = _classical_fernet(4).decrypt(b)
    b = _xor_keystream(b, _classical_key(3))
    b = _classical_fernet(2).decrypt(b)
    b = _rotating_substitution(b, _classical_key(1), encrypt=False)
    return b


# ─── Layer 2 (outermost) — envelope encryption (KMS-style key hierarchy) ────
@lru_cache(maxsize=None)
def _root_secret(version: int) -> bytes:
    salt = hashlib.sha256(f'pwvault-root-v{version}'.encode('utf-8')).digest()[:16]
    return hash_secret_raw(
        secret=settings.PWVAULT_SECRET_KEY.encode('utf-8'),
        salt=salt,
        time_cost=3,
        memory_cost=64 * 1024,
        parallelism=4,
        hash_len=32,
        type=Type.ID,
    )


def _hkdf(key_material: bytes, info: bytes, length: int = 32) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=length, salt=None, info=info).derive(key_material)


@lru_cache(maxsize=None)
def _kek(version: int) -> bytes:
    """Wraps each entry's one-time DEK — never used to encrypt data directly."""
    return _hkdf(_root_secret(version), b'pwvault-kek')


@lru_cache(maxsize=None)
def _integrity_key(version: int) -> bytes:
    return _hkdf(_root_secret(version), b'pwvault-integrity')


def _payload_keys(dek: bytes) -> tuple:
    return _hkdf(dek, b'pwvault-payload-layer-1'), _hkdf(dek, b'pwvault-payload-layer-2')


def _entry_aad(member_id, sequence: int, version: int) -> bytes:
    return f'{member_id}:{sequence}:{version}'.encode('utf-8')


# ─── HMAC hash-chain (tamper-evidence across a member's password history) ───
def _compute_chain_hash(version: int, prev_chain_hash, member_id, sequence: int,
                         dek_ciphertext: bytes, payload_ciphertext: bytes) -> str:
    mac = hmac.new(_integrity_key(version), digestmod=hashlib.sha256)
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


def verify_chain(history_rows) -> bool:
    """history_rows must belong to one member, ordered by sequence ascending."""
    prev = None
    for row in history_rows:
        expected = _compute_chain_hash(
            row.key_version, prev, row.member_id, row.sequence,
            _unb64(row.dek_envelope['ciphertext']), _unb64(row.ciphertext_layers['ciphertext']),
        )
        if expected != row.chain_hash:
            return False
        prev = row.chain_hash
    return True


# ─── Encrypt / decrypt a single history entry ────────────────────────────────
def encrypt_password_entry(raw: str, member_id, sequence: int, prev_chain_hash) -> dict:
    version = _CURRENT_KEY_VERSION
    aad = _entry_aad(member_id, sequence, version)

    payload = _classical_encrypt(raw.encode('utf-8'))  # layer 1, applied first/innermost

    dek = os.urandom(32)
    key1, key2 = _payload_keys(dek)

    nonce1 = os.urandom(_AESGCM_NONCE_SIZE)
    ct1 = AESGCM(key1).encrypt(nonce1, payload, aad)

    nonce2 = os.urandom(_AESGCM_NONCE_SIZE)
    ct2 = ChaCha20Poly1305(key2).encrypt(nonce2, ct1, aad)

    dek_nonce = os.urandom(_AESGCM_NONCE_SIZE)
    dek_ciphertext = AESGCM(_kek(version)).encrypt(dek_nonce, dek, aad)

    chain_hash = _compute_chain_hash(version, prev_chain_hash, member_id, sequence, dek_ciphertext, ct2)

    return {
        'key_version': version,
        'dek_envelope': {'nonce': _b64(dek_nonce), 'ciphertext': _b64(dek_ciphertext)},
        'ciphertext_layers': {'nonce1': _b64(nonce1), 'nonce2': _b64(nonce2), 'ciphertext': _b64(ct2)},
        'chain_hash': chain_hash,
        'prev_chain_hash': prev_chain_hash or '',
    }


def decrypt_password_entry(history_row) -> str:
    version = history_row.key_version
    aad = _entry_aad(history_row.member_id, history_row.sequence, version)

    dek_nonce = _unb64(history_row.dek_envelope['nonce'])
    dek_ciphertext = _unb64(history_row.dek_envelope['ciphertext'])
    dek = AESGCM(_kek(version)).decrypt(dek_nonce, dek_ciphertext, aad)

    key1, key2 = _payload_keys(dek)
    nonce1 = _unb64(history_row.ciphertext_layers['nonce1'])
    nonce2 = _unb64(history_row.ciphertext_layers['nonce2'])
    ciphertext = _unb64(history_row.ciphertext_layers['ciphertext'])

    ct1 = ChaCha20Poly1305(key2).decrypt(nonce2, ciphertext, aad)
    payload = AESGCM(key1).decrypt(nonce1, ct1, aad)

    # key_version 1 rows predate layer 1 (the classical stack above) -- their
    # envelope payload IS the raw plaintext already. Only key_version 2+ rows
    # need the extra unwrap. Keeps every row ever written decryptable.
    if version == _LEGACY_ENVELOPE_ONLY_VERSION:
        return payload.decode('utf-8')
    return _classical_decrypt(payload).decode('utf-8')


def record_password_history(member, raw_password) -> None:
    """Appends a new envelope-encrypted history row for `member` — called from
    Member.save() (backend/accounts/models.py) inside its existing
    transaction.atomic() block. Never overwrites a previous entry; every
    password set/change gets its own immutable, sequenced row."""
    from pwvault.models import PasswordVaultHistory

    last = (
        PasswordVaultHistory.objects.select_for_update()
        .filter(member=member)
        .order_by('-sequence')
        .first()
    )
    sequence = (last.sequence + 1) if last else 0
    prev_chain_hash = last.chain_hash if last else None
    fields = encrypt_password_entry(raw_password, member.id, sequence, prev_chain_hash)
    PasswordVaultHistory.objects.create(member=member, sequence=sequence, **fields)


# ─── Legacy (pre-history-table) decrypt — migration-only ────────────────────
# Reads ciphertext written by this module's very first revision, when the
# vault was a single-row-per-member table (PasswordVaultEntry) storing one
# self-contained, version-prefixed token produced by exactly the classical
# layer stack above (no envelope wrapping existed yet). Used exactly once, by
# migration 0003, to carry any such pre-existing row forward into the history
# table. Not part of any live encrypt/decrypt path.
def decrypt_password_legacy_v6(token: str) -> str:
    if not token.startswith(_CLASSICAL_VERSION_PREFIX):
        raise ValueError('Unsupported legacy vault ciphertext version.')
    b = token[len(_CLASSICAL_VERSION_PREFIX):].encode('ascii')
    return _classical_decrypt(b).decode('utf-8')
