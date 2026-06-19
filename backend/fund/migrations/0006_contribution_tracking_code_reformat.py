import random

from django.db import migrations


def reformat_tracking_codes(apps, schema_editor):
    """
    Replaces the legacy 'FUND-XXXXXX' tracking_code format with the unified
    site-wide scheme: {member_number:05d or '00000' for guest}F{random 3-digit}.
    Mirrors core.tracking_codes.generate_tracking_code()'s random-retry
    approach (migrations can't call that helper since it queries via the
    real model manager, not the historical one).
    """
    Contribution = apps.get_model('fund', 'Contribution')
    existing = set()
    for contribution in Contribution.objects.select_related('contributor').order_by('created_at'):
        member_number = contribution.contributor.member_number if contribution.contributor_id else None
        prefix = f'{member_number:05d}' if member_number else '00000'
        for _ in range(20):
            candidate = f'{prefix}F{random.randint(0, 999):03d}'
            if candidate not in existing:
                existing.add(candidate)
                break
        else:
            raise RuntimeError('Could not generate a unique tracking code.')
        contribution.tracking_code = candidate
        contribution.save(update_fields=['tracking_code'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("fund", "0005_contribution_tracking_code"),
    ]

    operations = [
        migrations.RunPython(reformat_tracking_codes, noop_reverse),
    ]
