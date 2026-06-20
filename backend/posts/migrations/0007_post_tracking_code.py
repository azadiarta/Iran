import random

from django.db import migrations, models


def backfill_tracking_codes(apps, schema_editor):
    Post = apps.get_model('posts', 'Post')
    existing = set(
        Post.objects.exclude(tracking_code__isnull=True)
        .exclude(tracking_code='')
        .values_list('tracking_code', flat=True)
    )
    for post in Post.objects.select_related('author').filter(
        models.Q(tracking_code__isnull=True) | models.Q(tracking_code='')
    ):
        member_number = post.author.member_number if post.author_id else None
        prefix = f'{member_number:05d}' if member_number else '00000'
        for _ in range(20):
            candidate = f'{prefix}P{random.randint(0, 999):03d}'
            if candidate not in existing:
                existing.add(candidate)
                break
        else:
            raise RuntimeError('Could not generate a unique tracking code.')
        post.tracking_code = candidate
        post.save(update_fields=['tracking_code'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("posts", "0006_alter_comment_rejection_reason_alter_comment_text_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="post",
            name="tracking_code",
            field=models.CharField(
                blank=True, editable=False, max_length=20, null=True, unique=True
            ),
        ),
        migrations.RunPython(backfill_tracking_codes, noop_reverse),
        migrations.AlterField(
            model_name="post",
            name="tracking_code",
            field=models.CharField(
                blank=True, editable=False, max_length=20, unique=True
            ),
        ),
    ]
