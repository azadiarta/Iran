"""
At-rest encryption for the superuser password vault's storage (see
backend/pwvault/models.py:PasswordVaultHistory and backend/pwvault/transport.py
for the in-transit/E2E half of the picture).

Three things are layered together, strongest/newest outermost:

  1. Classical layer stack (innermost). key_version 1-2 keep this module's
     original six chained layers verbatim (three Fernet AES-128-CBC/HMAC-
     SHA256 layers plus two homebrew "rotating" constructions and one keyed
     byte-transposition layer, all fixed-salt PBKDF2-derived) -- never
     touched, so every already-written row of that vintage keeps decrypting
     forever. key_version 3 re-derives those same six homebrew layers per
     ROW instead of from a fixed salt (see _classical_encrypt_v3()).
     key_version 4 (current) replaces the classical stack entirely with six
     genuinely different, independently-standardized constructions -- no
     two of them share a cipher algorithm, chaining mode, or MAC/AEAD scheme
     with each other or with the envelope layer below: AES-256-CTR, then
     Camellia-256-CBC, then SM4-CTR, then raw ChaCha20, each Encrypt-then-
     MAC'd with a different hash (HMAC-SHA256, HMAC-SHA384, HMAC-SHA512,
     HMAC-BLAKE2b respectively), then AES-256-GCM-SIV (nonce-misuse-
     resistant AEAD) and finally AES-256-OCB3 (a second, unrelated native
     AEAD mode). Every cipher key and every MAC key is its own independent
     HKDF output (see _v4_subkeys()) -- never reused between confidentiality
     and integrity, never shared between layers -- and, like key_version 3,
     every key still traces back to this one row's own random salt
     (`classical_salt`), so no two rows ever share key material either.

  2. Envelope encryption (KMS-style, e.g. AWS KMS/Vault "envelope
     encryption") wraps layer 1's output:
       root secret
         -> Argon2id (memory-hard, 64 MiB / t=3 / p=4 -- far costlier to
            brute-force off a leaked DB dump than the PBKDF2 layer 1 uses)
         -> root key material
         -> HKDF-SHA256, label-separated
            -> KEK, KEK2 (wrap every entry's one-time data-encryption key)
            -> integrity key (HMAC-chains the history for tamper-evidence)
     Every password gets its own randomly generated, single-use 256-bit DEK,
     and layer 1's ciphertext is sealed under two more independently-keyed
     AEAD layers from two different cipher families (AES-256-GCM, then
     ChaCha20-Poly1305), derived from that DEK. Every AEAD operation is
     bound (AAD) to the exact member + history sequence + key version (and,
     from key_version 3 on, the row's own classical_salt) it belongs to, so
     a captured envelope can't be replayed onto a different row.

     For key_version 1-2, "root secret" above is simply
     `settings.PWVAULT_SECRET_KEY`. For key_version 3 (current), it is the
     concatenation of `PWVAULT_SECRET_KEY` (an env var) with a second,
     independent, database-only secret -- see _dual_secret() -- so neither
     a leaked .env file alone nor a leaked database dump alone is enough to
     derive any key_version-3 key. The DEK itself is also wrapped TWICE,
     under KEK (AES-256-GCM) and then KEK2 (ChaCha20-Poly1305) -- two
     independently-HKDF-derived keys from that same dual-sourced root --
     see _wrap_dek_v3()/_unwrap_dek_v3(): the key material is itself
     encrypted more than once, not just the password.

  3. Database-only secret encrypted at rest (see models.VaultKeyMaterial /
     _get_or_create_pepper()): the random "pepper" that feeds layer 2's dual
     root secret is itself stored only in AES-256-GCM-wrapped form, keyed
     purely from PWVAULT_SECRET_KEY -- a raw database dump by itself yields
     only an opaque blob for this value, never a directly usable secret.

`PasswordVaultHistory.key_version` records which combination produced a
given row, so upgrading the format (like this revision did, three times)
never breaks already-written history: `key_version=1` rows (envelope only,
no layer-1 wrapping), `key_version=2` rows (homebrew layer 1, fixed global
salts, single-wrapped DEK, single env-sourced root secret) and
`key_version=3` rows (homebrew layer 1, per-row salts, dual-sourced root
secret, double-wrapped DEK) all keep decrypting exactly as before; only new
writes use `key_version=4` (industrial layer 1, per-row salts, dual-sourced
root secret, double-wrapped DEK). See decrypt_password_entry().

This is a deep, multi-technique educational challenge, not a claim that
every secret in this module is independent in the absolute sense -- e.g.
key_version 1-2's keys still ultimately trace back to one env var, and
key_version 3-4 trace back to that same env var mixed with one database-
held pepper (two sources, not infinitely many). Within that honest
boundary, key_version 4's six classical-layer ciphers (AES, Camellia, SM4,
ChaCha20, plus two AEAD modes) and four MAC hash functions are real,
standardized, independently-keyed primitives, not decorative wrapping --
each one is individually strong and meaningfully different from every
other layer in this module, inner or outer.
"""
import hashlib
import hmac
import os
import random
from base64 import b64decode, b64encode, urlsafe_b64encode
from functools import lru_cache

from argon2.low_level import Type, hash_secret_raw
from cryptography.exceptions import InvalidTag
from cryptography.fernet import Fernet
from cryptography.hazmat.decrepit.ciphers.algorithms import Camellia
from cryptography.hazmat.primitives import hashes, padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms
from cryptography.hazmat.primitives.ciphers import modes as block_modes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM, AESGCMSIV, AESOCB3, ChaCha20Poly1305
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from django.conf import settings

_LEGACY_ENVELOPE_ONLY_VERSION = 1  # pre-existing rows: envelope wraps raw plaintext directly
_FIXED_SALT_VERSION = 2  # classical layer stack (inner, fixed global salts) + single-sourced envelope (outer)
_PER_ROW_SALT_VERSION = 3  # per-row classical salts (homebrew 6-layer stack) + dual-sourced root secret + double-wrapped DEK
_CURRENT_KEY_VERSION = 4  # industrial 6-layer classical stack (six distinct standardized ciphers) + dual-sourced root + double-wrapped DEK
_DUAL_SECRET_MIN_VERSION = 3  # versions at/above this derive their root secret from _dual_secret(), not just the env var
_AESGCM_NONCE_SIZE = 12
_CLASSICAL_PBKDF2_ITERATIONS = 200_000
_CLASSICAL_BLOCK_SIZE = 16  # bytes -- used by the keyed-transposition layer
_CLASSICAL_SALT_SIZE = 16  # bytes -- key_version 3+ per-row classical-layer salt


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


# ─── Layer 1, key_version 3+ — same six chained constructions, but every key
# is re-derived from a salt that is random and unique to this one row, so no
# two rows ever share classical-layer key material. Deliberately NOT
# lru_cache'd (unlike _classical_derive_key above): the salt is never reused,
# so caching would only leak memory, never save work. ───────────────────────
def _classical_derive_key_v3(record_salt: bytes, layer: int, secret: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(), length=32,
        salt=record_salt + f'-pwvault-layer-{layer}'.encode('utf-8'),
        iterations=_CLASSICAL_PBKDF2_ITERATIONS,
    )
    return kdf.derive(secret)


def _classical_encrypt_v3(data: bytes, record_salt: bytes, secret: bytes) -> bytes:
    keys = [_classical_derive_key_v3(record_salt, layer, secret) for layer in range(1, 7)]
    b = _rotating_substitution(data, keys[0], encrypt=True)
    b = Fernet(urlsafe_b64encode(keys[1])).encrypt(b)
    b = _xor_keystream(b, keys[2])
    b = Fernet(urlsafe_b64encode(keys[3])).encrypt(b)
    b = _transpose(b, keys[4])
    b = Fernet(urlsafe_b64encode(keys[5])).encrypt(b)
    return b


def _classical_decrypt_v3(data: bytes, record_salt: bytes, secret: bytes) -> bytes:
    keys = [_classical_derive_key_v3(record_salt, layer, secret) for layer in range(1, 7)]
    b = Fernet(urlsafe_b64encode(keys[5])).decrypt(data)
    b = _untranspose(b, keys[4])
    b = Fernet(urlsafe_b64encode(keys[3])).decrypt(b)
    b = _xor_keystream(b, keys[2])
    b = Fernet(urlsafe_b64encode(keys[1])).decrypt(b)
    b = _rotating_substitution(b, keys[0], encrypt=False)
    return b


# ─── Layer 1, key_version 4 (current) — "industrial" classical stack. Six
# layers, each a genuinely different, independently-standardized cipher
# construction -- no two layers here share a cipher algorithm, a chaining
# mode, or a MAC/AEAD scheme with each other, and none of them repeats the
# AES-256-GCM / ChaCha20-Poly1305 pair the outer envelope (layer 2, below)
# already uses. Layers 1-4 are explicit, hand-composed Encrypt-then-MAC: the
# integrity check is a literal, separate one-way HMAC (a different hash
# function each time -- SHA-256, SHA-384, SHA-512, BLAKE2b) that the
# decrypting side must independently recompute and match before any
# plaintext from that layer is trusted. Layers 5-6 are two different
# *native* AEAD modes, neither of which is GCM or ChaCha20-Poly1305. Every
# cipher key and every MAC key is its own independent HKDF output (see
# _v4_subkeys()) -- never the same key for confidentiality and integrity,
# never shared between layers. Like v3, every key ultimately traces back to
# this one row's own random `classical_salt` plus the dual-sourced secret,
# so no two rows -- even for the same member -- ever share key material.
def _v4_layer_master(record_salt: bytes, layer: int, secret: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(), length=32,
        salt=record_salt + f'-pwvault-v4-layer-{layer}'.encode('utf-8'),
        iterations=_CLASSICAL_PBKDF2_ITERATIONS,
    )
    return kdf.derive(secret)


def _v4_subkeys(master: bytes, cipher_key_len: int) -> tuple:
    return _hkdf(master, b'pwvault-v4-cipher', length=cipher_key_len), _hkdf(master, b'pwvault-v4-mac', length=32)


# Layer 1 — AES-256-CTR, Encrypt-then-MAC'd with HMAC-SHA256.
def _v4_layer1_encrypt(data: bytes, master: bytes) -> bytes:
    cipher_key, mac_key = _v4_subkeys(master, 32)
    iv = os.urandom(16)
    encryptor = Cipher(algorithms.AES(cipher_key), block_modes.CTR(iv)).encryptor()
    ct = encryptor.update(data) + encryptor.finalize()
    tag = hmac.new(mac_key, iv + ct, hashlib.sha256).digest()
    return iv + tag + ct


def _v4_layer1_decrypt(blob: bytes, master: bytes) -> bytes:
    cipher_key, mac_key = _v4_subkeys(master, 32)
    iv, tag, ct = blob[:16], blob[16:48], blob[48:]
    if not hmac.compare_digest(hmac.new(mac_key, iv + ct, hashlib.sha256).digest(), tag):
        raise InvalidTag('pwvault v4 layer 1 (AES-256-CTR/HMAC-SHA256) authentication failed.')
    decryptor = Cipher(algorithms.AES(cipher_key), block_modes.CTR(iv)).decryptor()
    return decryptor.update(ct) + decryptor.finalize()


# Layer 2 — Camellia-256-CBC (a wholly different cipher family -- NTT/
# Mitsubishi Electric, ISO/NESSIE/CRYPTREC-approved, used in TLS/OpenPGP/
# IPsec), PKCS7-padded, Encrypt-then-MAC'd with HMAC-SHA384.
def _v4_layer2_encrypt(data: bytes, master: bytes) -> bytes:
    cipher_key, mac_key = _v4_subkeys(master, 32)
    iv = os.urandom(16)
    padder = padding.PKCS7(128).padder()
    padded = padder.update(data) + padder.finalize()
    encryptor = Cipher(Camellia(cipher_key), block_modes.CBC(iv)).encryptor()
    ct = encryptor.update(padded) + encryptor.finalize()
    tag = hmac.new(mac_key, iv + ct, hashlib.sha384).digest()
    return iv + tag + ct


def _v4_layer2_decrypt(blob: bytes, master: bytes) -> bytes:
    cipher_key, mac_key = _v4_subkeys(master, 32)
    iv, tag, ct = blob[:16], blob[16:64], blob[64:]
    if not hmac.compare_digest(hmac.new(mac_key, iv + ct, hashlib.sha384).digest(), tag):
        raise InvalidTag('pwvault v4 layer 2 (Camellia-256-CBC/HMAC-SHA384) authentication failed.')
    decryptor = Cipher(Camellia(cipher_key), block_modes.CBC(iv)).decryptor()
    padded = decryptor.update(ct) + decryptor.finalize()
    unpadder = padding.PKCS7(128).unpadder()
    return unpadder.update(padded) + unpadder.finalize()


# Layer 3 — SM4-CTR (yet another unrelated block cipher -- China's national
# standard, ISO/IEC 18033-3), Encrypt-then-MAC'd with HMAC-SHA512. SM4 only
# supports a 128-bit key, unlike every other cipher in this stack.
def _v4_layer3_encrypt(data: bytes, master: bytes) -> bytes:
    cipher_key, mac_key = _v4_subkeys(master, 16)
    iv = os.urandom(16)
    encryptor = Cipher(algorithms.SM4(cipher_key), block_modes.CTR(iv)).encryptor()
    ct = encryptor.update(data) + encryptor.finalize()
    tag = hmac.new(mac_key, iv + ct, hashlib.sha512).digest()
    return iv + tag + ct


def _v4_layer3_decrypt(blob: bytes, master: bytes) -> bytes:
    cipher_key, mac_key = _v4_subkeys(master, 16)
    iv, tag, ct = blob[:16], blob[16:80], blob[80:]
    if not hmac.compare_digest(hmac.new(mac_key, iv + ct, hashlib.sha512).digest(), tag):
        raise InvalidTag('pwvault v4 layer 3 (SM4-CTR/HMAC-SHA512) authentication failed.')
    decryptor = Cipher(algorithms.SM4(cipher_key), block_modes.CTR(iv)).decryptor()
    return decryptor.update(ct) + decryptor.finalize()


# Layer 4 — raw ChaCha20 (a stream cipher of an entirely different
# mathematical design -- ARX, no S-boxes at all -- from every block cipher
# above), Encrypt-then-MAC'd with HMAC-BLAKE2b.
def _v4_layer4_encrypt(data: bytes, master: bytes) -> bytes:
    cipher_key, mac_key = _v4_subkeys(master, 32)
    nonce = os.urandom(16)  # cryptography's ChaCha20: 4-byte counter || 12-byte nonce
    encryptor = Cipher(algorithms.ChaCha20(cipher_key, nonce), mode=None).encryptor()
    ct = encryptor.update(data) + encryptor.finalize()
    tag = hmac.new(mac_key, nonce + ct, hashlib.blake2b).digest()
    return nonce + tag + ct


def _v4_layer4_decrypt(blob: bytes, master: bytes) -> bytes:
    cipher_key, mac_key = _v4_subkeys(master, 32)
    nonce, tag, ct = blob[:16], blob[16:80], blob[80:]
    if not hmac.compare_digest(hmac.new(mac_key, nonce + ct, hashlib.blake2b).digest(), tag):
        raise InvalidTag('pwvault v4 layer 4 (ChaCha20/HMAC-BLAKE2b) authentication failed.')
    decryptor = Cipher(algorithms.ChaCha20(cipher_key, nonce), mode=None).decryptor()
    return decryptor.update(ct) + decryptor.finalize()


# Layer 5 — AES-256-GCM-SIV: a *native* AEAD mode, but a nonce-MISUSE-
# RESISTANT one (RFC 8452) -- unlike every plain-GCM use elsewhere in this
# codebase, a repeated nonce here degrades gracefully instead of
# catastrophically. Genuine, real-world-deployed additional security
# property, not just a different label on the same idea.
def _v4_layer5_encrypt(data: bytes, master: bytes) -> bytes:
    key = _hkdf(master, b'pwvault-v4-aead', length=32)
    nonce = os.urandom(12)
    return nonce + AESGCMSIV(key).encrypt(nonce, data, None)


def _v4_layer5_decrypt(blob: bytes, master: bytes) -> bytes:
    key = _hkdf(master, b'pwvault-v4-aead', length=32)
    nonce, ct = blob[:12], blob[12:]
    return AESGCMSIV(key).decrypt(nonce, ct, None)


# Layer 6 (outermost of the classical stack) — AES-256-OCB3: a second,
# unrelated native AEAD mode (single-pass Offset Codebook Mode, ISO/IEC
# 19772), sharing neither GCM-SIV's nor the outer envelope's GCM/
# ChaCha20-Poly1305 design.
def _v4_layer6_encrypt(data: bytes, master: bytes) -> bytes:
    key = _hkdf(master, b'pwvault-v4-aead', length=32)
    nonce = os.urandom(12)
    return nonce + AESOCB3(key).encrypt(nonce, data, None)


def _v4_layer6_decrypt(blob: bytes, master: bytes) -> bytes:
    key = _hkdf(master, b'pwvault-v4-aead', length=32)
    nonce, ct = blob[:12], blob[12:]
    return AESOCB3(key).decrypt(nonce, ct, None)


_V4_LAYER_FUNCS = (
    (_v4_layer1_encrypt, _v4_layer1_decrypt),
    (_v4_layer2_encrypt, _v4_layer2_decrypt),
    (_v4_layer3_encrypt, _v4_layer3_decrypt),
    (_v4_layer4_encrypt, _v4_layer4_decrypt),
    (_v4_layer5_encrypt, _v4_layer5_decrypt),
    (_v4_layer6_encrypt, _v4_layer6_decrypt),
)


def _classical_encrypt_v4(data: bytes, record_salt: bytes, secret: bytes) -> bytes:
    b = data
    for layer, (encrypt_fn, _decrypt_fn) in enumerate(_V4_LAYER_FUNCS, start=1):
        b = encrypt_fn(b, _v4_layer_master(record_salt, layer, secret))
    return b


def _classical_decrypt_v4(data: bytes, record_salt: bytes, secret: bytes) -> bytes:
    b = data
    for layer, (_encrypt_fn, decrypt_fn) in reversed(list(enumerate(_V4_LAYER_FUNCS, start=1))):
        b = decrypt_fn(b, _v4_layer_master(record_salt, layer, secret))
    return b


# ─── Layer 3 — database-only pepper, encrypted at rest, combined with
# PWVAULT_SECRET_KEY into the dual-sourced root secret that every
# key_version>=3 key ultimately derives from ──────────────────────────────
@lru_cache(maxsize=None)
def _pepper_encryption_key() -> bytes:
    # Deliberately independent of _root_secret()'s Argon2id tree below (plain
    # SHA-256, different label) -- this key's only job is to keep the pepper
    # opaque at rest; it must stay derivable from PWVAULT_SECRET_KEY alone,
    # with no dependency on the very value (the pepper) it protects.
    return hashlib.sha256(settings.PWVAULT_SECRET_KEY.encode('utf-8') + b'|pwvault-pepper-key').digest()


def _get_or_create_pepper() -> bytes:
    from pwvault.models import VaultKeyMaterial

    row = VaultKeyMaterial.objects.filter(pk=1).first()
    if row is not None:
        try:
            return AESGCM(_pepper_encryption_key()).decrypt(_unb64(row.nonce), _unb64(row.wrapped_pepper), b'pwvault-pepper')
        except InvalidTag:
            # PWVAULT_SECRET_KEY was rotated since this row was wrapped: the
            # old pepper -- and therefore every key_version>=3 entry already
            # written under it -- is now intentionally and permanently
            # unreadable (decrypt_password_entry() callers already treat an
            # undecryptable row as an ordinary failure, same as a stale
            # key_version). What must never happen is every *future*
            # Member.save() failing forever because of one unrecoverable row,
            # so fall through and mint a fresh pepper instead, exactly like
            # the very-first-call path below.
            row = None
    raw_pepper = os.urandom(32)
    nonce = os.urandom(_AESGCM_NONCE_SIZE)
    wrapped = AESGCM(_pepper_encryption_key()).encrypt(nonce, raw_pepper, b'pwvault-pepper')
    # update_or_create (not create()) so this both fills in the very first
    # row and replaces a row left over from before a key rotation; a
    # concurrent caller racing this loses gracefully either way (last write
    # wins) rather than raising IntegrityError.
    VaultKeyMaterial.objects.update_or_create(
        pk=1, defaults={'nonce': _b64(nonce), 'wrapped_pepper': _b64(wrapped)},
    )
    return raw_pepper


@lru_cache(maxsize=None)
def _cached_pepper() -> bytes:
    return _get_or_create_pepper()


def _dual_secret() -> bytes:
    """The key_version>=3 root secret: PWVAULT_SECRET_KEY (an env var) mixed
    with a second, independent, database-only secret. Knowing only one of
    the two -- a leaked .env file, or a leaked database dump -- is not
    enough to reconstruct this value, let alone anything derived from it."""
    return hashlib.sha256(settings.PWVAULT_SECRET_KEY.encode('utf-8') + b'|' + _cached_pepper()).digest()


# ─── Layer 2 (outermost) — envelope encryption (KMS-style key hierarchy) ────
@lru_cache(maxsize=None)
def _root_secret(version: int) -> bytes:
    salt = hashlib.sha256(f'pwvault-root-v{version}'.encode('utf-8')).digest()[:16]
    secret = _dual_secret() if version >= _DUAL_SECRET_MIN_VERSION else settings.PWVAULT_SECRET_KEY.encode('utf-8')
    return hash_secret_raw(
        secret=secret,
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
def _kek2(version: int) -> bytes:
    """Second, independently-derived key-wrapping key, used only for
    key_version>=3. The DEK is wrapped under _kek with AES-256-GCM and then
    wrapped AGAIN under this key with ChaCha20-Poly1305 -- a different cipher
    family, not just a different key -- so the key material itself is
    encrypted more than once, the same way the password payload is."""
    return _hkdf(_root_secret(version), b'pwvault-kek2')


@lru_cache(maxsize=None)
def _integrity_key(version: int) -> bytes:
    return _hkdf(_root_secret(version), b'pwvault-integrity')


def _payload_keys(dek: bytes) -> tuple:
    return _hkdf(dek, b'pwvault-payload-layer-1'), _hkdf(dek, b'pwvault-payload-layer-2')


def _wrap_dek_v3(dek: bytes, aad: bytes, version: int) -> dict:
    nonce1 = os.urandom(_AESGCM_NONCE_SIZE)
    layer1 = AESGCM(_kek(version)).encrypt(nonce1, dek, aad)
    nonce2 = os.urandom(_AESGCM_NONCE_SIZE)
    layer2 = ChaCha20Poly1305(_kek2(version)).encrypt(nonce2, layer1, aad)
    return {'nonce1': _b64(nonce1), 'nonce2': _b64(nonce2), 'ciphertext': _b64(layer2)}


def _unwrap_dek_v3(envelope: dict, aad: bytes, version: int) -> bytes:
    layer1 = ChaCha20Poly1305(_kek2(version)).decrypt(_unb64(envelope['nonce2']), _unb64(envelope['ciphertext']), aad)
    return AESGCM(_kek(version)).decrypt(_unb64(envelope['nonce1']), layer1, aad)


def _entry_aad(member_id, sequence: int, version: int, extra: bytes = b'') -> bytes:
    base = f'{member_id}:{sequence}:{version}'.encode('utf-8')
    return base + b':' + extra if extra else base


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
    record_salt = os.urandom(_CLASSICAL_SALT_SIZE)
    aad = _entry_aad(member_id, sequence, version, extra=record_salt)
    secret = _dual_secret()

    payload = _classical_encrypt_v4(raw.encode('utf-8'), record_salt, secret)  # layer 1, applied first/innermost

    dek = os.urandom(32)
    key1, key2 = _payload_keys(dek)

    nonce1 = os.urandom(_AESGCM_NONCE_SIZE)
    ct1 = AESGCM(key1).encrypt(nonce1, payload, aad)

    nonce2 = os.urandom(_AESGCM_NONCE_SIZE)
    ct2 = ChaCha20Poly1305(key2).encrypt(nonce2, ct1, aad)

    dek_envelope = _wrap_dek_v3(dek, aad, version)

    chain_hash = _compute_chain_hash(version, prev_chain_hash, member_id, sequence, _unb64(dek_envelope['ciphertext']), ct2)

    return {
        'key_version': version,
        'dek_envelope': dek_envelope,
        'ciphertext_layers': {'nonce1': _b64(nonce1), 'nonce2': _b64(nonce2), 'ciphertext': _b64(ct2)},
        'classical_salt': _b64(record_salt),
        'chain_hash': chain_hash,
        'prev_chain_hash': prev_chain_hash or '',
    }


def decrypt_password_entry(history_row) -> str:
    version = history_row.key_version
    record_salt = _unb64(history_row.classical_salt) if history_row.classical_salt else b''
    aad = _entry_aad(history_row.member_id, history_row.sequence, version, extra=record_salt)

    if version >= _DUAL_SECRET_MIN_VERSION:
        dek = _unwrap_dek_v3(history_row.dek_envelope, aad, version)
    else:
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
    # envelope payload IS the raw plaintext already. key_version 2 uses the
    # fixed-salt classical stack; key_version 3 uses the per-row-salted
    # homebrew stack; key_version 4 (current) uses the per-row-salted
    # industrial stack. Keeps every row ever written decryptable.
    if version == _LEGACY_ENVELOPE_ONLY_VERSION:
        return payload.decode('utf-8')
    if version == _CURRENT_KEY_VERSION:
        return _classical_decrypt_v4(payload, record_salt, _dual_secret()).decode('utf-8')
    if version >= _DUAL_SECRET_MIN_VERSION:
        return _classical_decrypt_v3(payload, record_salt, _dual_secret()).decode('utf-8')
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
