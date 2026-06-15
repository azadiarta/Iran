# Generated for Phase 17: remove the environment-variables admin panel.

from django.db import migrations


def remove_env_var_permission(apps, schema_editor):
    Permission = apps.get_model('core', 'Permission')
    Permission.objects.filter(codename='can_manage_env_vars').delete()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_envvaroverride"),
    ]

    operations = [
        migrations.DeleteModel(
            name="EnvVarOverride",
        ),
        migrations.RunPython(remove_env_var_permission, noop),
    ]
