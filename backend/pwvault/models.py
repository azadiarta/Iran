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
    # {'nonce': b64, 'ciphertext': b64} — the per-entry DEK, AES-256-GCM-wrapped under the KEK.
    dek_envelope = models.JSONField()
    # {'nonce1': b64, 'nonce2': b64, 'ciphertext': b64} — the password itself,
    # under two independently-keyed AEAD layers (AES-256-GCM, then ChaCha20-Poly1305).
    ciphertext_layers = models.JSONField()
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
