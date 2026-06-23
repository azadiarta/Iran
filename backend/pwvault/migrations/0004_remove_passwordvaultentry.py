from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('pwvault', '0003_migrate_legacy_vault_entries'),
    ]

    operations = [
        migrations.DeleteModel(
            name='PasswordVaultEntry',
        ),
    ]
