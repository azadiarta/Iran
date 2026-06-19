import random

from django.db import migrations, models


def backfill_tracking_codes(apps, schema_editor):
    Comment = apps.get_model('posts', 'Comment')
    existing = set(
        Comment.objects.exclude(tracking_code__isnull=True)
        .exclude(tracking_code='')
        .values_list('tracking_code', flat=True)
    )
    for comment in Comment.objects.select_related('author').filter(
        models.Q(tracking_code__isnull=True) | models.Q(tracking_code='')
    ):
        member_number = comment.author.member_number if comment.author_id else None
        prefix = f'{member_number:05d}' if member_number else '00000'
        for _ in range(20):
            candidate = f'{prefix}C{random.randint(0, 999):03d}'
            if candidate not in existing:
                existing.add(candidate)
                break
        else:
            raise RuntimeError('Could not generate a unique tracking code.')
        comment.tracking_code = candidate
        comment.save(update_fields=['tracking_code'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("posts", "0004_comment_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="comment",
            name="tracking_code",
            field=models.CharField(
                blank=True, editable=False, max_length=20, null=True, unique=True
            ),
        ),
        migrations.RunPython(backfill_tracking_codes, noop_reverse),
        migrations.AlterField(
            model_name="comment",
            name="tracking_code",
            field=models.CharField(
                blank=True, editable=False, max_length=20, unique=True
            ),
        ),
    ]
