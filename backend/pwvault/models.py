import uuid

from django.db import models


# Educational-lab feature (see backend/pwvault/crypto.py for the full crypto
# design): an append-only, envelope-encrypted history of every password a
# member has ever had — one immutable row per password set/change, never
# overwritten. Rows are only ever written from Member.save() via
# pwvault.crypto.record_password_history() (backend/accounts/models.py);
# members whose password predates this feature simply have no rows here.
#
# `chain_hash` HMAC-chains each row to the one before it (per member), so any
# out-of-band edit to dek_envelope/ciphertext_layers/chain_hash is detectable
# via pwvault.crypto.verify_chain() — tampering with the table directly (e.g.
# a raw SQL UPDATE) breaks the chain instead of silently succeeding.
class PasswordVaultHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.ForeignKey(
        'accounts.Member', on_delete=models.CASCADE,
        related_name='password_vault_history',
    )
    # 0-based, per-member, assigned by record_password_history().
    sequence = models.PositiveIntegerField()
    key_version = models.PositiveSmallIntegerField()
    # The per-entry DEK, wrapped under the KEK. key_version 1-2:
    # {'nonce': b64, 'ciphertext': b64} (single AES-256-GCM wrap). key_version
    # 3+: {'nonce1': b64, 'nonce2': b64, 'ciphertext': b64} (the DEK is
    # wrapped TWICE, under two independently-derived KEKs from two different
    # AEAD families — AES-256-GCM then ChaCha20-Poly1305 — see
    # pwvault/crypto.py's _wrap_dek_v3()).
    dek_envelope = models.JSONField()
    # {'nonce1': b64, 'nonce2': b64, 'ciphertext': b64} — the password itself,
    # under two independently-keyed AEAD layers (AES-256-GCM, then ChaCha20-Poly1305).
    ciphertext_layers = models.JSONField()
    # b64, random per row -- key_version>=3 only (blank for older rows). Folded
    # into both the classical layer's per-layer key derivation and the entry
    # AAD, so no two rows -- even for the same member -- ever share classical-
    # layer key material. See pwvault/crypto.py's module docstring.
    classical_salt = models.TextField(blank=True, default='')
    chain_hash = models.CharField(max_length=64)
    prev_chain_hash = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['member', 'sequence']
        constraints = [
            models.UniqueConstraint(fields=['member', 'sequence'], name='pwvault_history_unique_sequence'),
        ]

    def __str__(self):
        return f'vault history #{self.sequence} for {self.member_id}'


# Singleton row (always pk=1) holding the database-only secret ("pepper")
# that pwvault/crypto.py's key_version>=3 root-key derivation combines with
# settings.PWVAULT_SECRET_KEY (see crypto.py's _dual_secret()). Splitting the
# at-rest root secret across two independent sources — an env var and a
# DB-only value generated here, never derivable from one another — means
# neither a leaked .env file alone nor a leaked database dump alone is
# enough to derive any key_version>=3 key.
#
# The pepper itself is never stored in the clear: it is AES-256-GCM-wrapped
# (keyed purely from PWVAULT_SECRET_KEY — see crypto.py's
# _pepper_encryption_key()) so a raw DB leak by itself yields only an
# opaque, useless blob, never a directly usable secret. This is the literal
# "encrypt the key itself" requirement, applied to the one piece of key
# material that ever touches the database.
class VaultKeyMaterial(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1)
    nonce = models.TextField()
    wrapped_pepper = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return 'pwvault key material (singleton)'
