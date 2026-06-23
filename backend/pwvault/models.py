import uuid

from django.db import models


# Educational-lab feature (see backend/pwvault/crypto.py for context): holds a
# reversible, multi-layer-encrypted copy of each member's LATEST password, so
# the superuser can view it from the admin panel. One row per member — every
# password change overwrites the existing row (no history is kept). Rows are
# only ever written from Member.save() (backend/accounts/models.py); members
# whose password predates this feature simply have no row here.
class PasswordVaultEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.OneToOneField(
        'accounts.Member', on_delete=models.CASCADE,
        related_name='password_vault_entry',
    )
    ciphertext = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'vault entry for {self.member_id}'
