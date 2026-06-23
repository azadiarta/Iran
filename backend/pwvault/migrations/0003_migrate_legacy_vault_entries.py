# Carries forward any pre-existing PasswordVaultEntry row (single-entry,
# 6-layer-Fernet ciphertext, the original revision of this feature) into the
# new append-only PasswordVaultHistory table as that member's sequence=0
# entry, using the new envelope-encryption scheme. A row that fails to
# decrypt (e.g. PWVAULT_SECRET_KEY already rotated) is skipped rather than
# aborting the whole migration -- this app has no backfill guarantee for
# passwords set before this feature existed in the first place, so losing
# one already-unrecoverable legacy row here is not a regression.
from django.db import migrations

from pwvault.crypto import decrypt_password_legacy_v6, encrypt_password_entry


def migrate_legacy_entries(apps, schema_editor):
    PasswordVaultEntry = apps.get_model('pwvault', 'PasswordVaultEntry')
    PasswordVaultHistory = apps.get_model('pwvault', 'PasswordVaultHistory')

    for entry in PasswordVaultEntry.objects.all():
        try:
            raw_password = decrypt_password_legacy_v6(entry.ciphertext)
        except Exception:
            continue
        fields = encrypt_password_entry(raw_password, entry.member_id, sequence=0, prev_chain_hash=None)
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
