from django.db.models.signals import pre_delete
from django.dispatch import receiver


@receiver(pre_delete, sender='accounts.AccessGroup')
def on_access_group_delete(sender, instance, **kwargs):
    # Move members to the default group (or null if none) before the group is deleted.
    from accounts.models import AccessGroup, Member
    default = AccessGroup.objects.filter(is_default=True).exclude(pk=instance.pk).first()
    Member.objects.filter(group=instance).update(group=default)


@receiver(pre_delete, sender='posts.Post')
def on_post_delete(sender, instance, **kwargs):
    from django.contrib.contenttypes.models import ContentType
    from logs.models import ActivityLog
    from posts.models import Comment
    ct = ContentType.objects.get_for_model(instance)
    Comment.objects.filter(content_type=ct, object_id=instance.pk).delete()
    ActivityLog.objects.create(
        actor=None,
        actor_display='system',
        action='deleted_post',
        target_display=str(instance),
    )


@receiver(pre_delete, sender='fund.Expense')
def on_expense_delete(sender, instance, **kwargs):
    from django.contrib.contenttypes.models import ContentType
    from logs.models import ActivityLog
    from posts.models import Comment
    ct = ContentType.objects.get_for_model(instance)
    Comment.objects.filter(content_type=ct, object_id=instance.pk).delete()
    ActivityLog.objects.create(
        actor=None,
        actor_display='system',
        action='deleted_expense',
        target_display=str(instance),
    )


@receiver(pre_delete, sender='accounts.Member')
def on_member_delete(sender, instance, **kwargs):
    from core.log_utils import target_display_for
    from logs.models import ActivityLog
    ActivityLog.objects.create(
        actor=None,
        actor_display='system',
        action='deleted_member',
        target_display=target_display_for(instance),
    )
