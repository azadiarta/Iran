import uuid
from django.contrib.contenttypes.models import ContentType
from django.db import models


# Immutable — no updated_at. Tracks every user-initiated action.
# actor_display + target_display are snapshots at action time (survive deletions).
# Superuser sees all; group admins see scoped subset per access rules.
# action values: created_post, deleted_comment, changed_permission, login, logout,
#   failed_login, contributed, added_expense, approved_comment, edited_post,
#   deleted_post, changed_group, created_member, deactivated_member,
#   password_vault_viewed, password_vault_history_viewed

class ActivityLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        'accounts.Member', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='activity_logs',
    )
    actor_display = models.CharField(max_length=100)
    action = models.CharField(max_length=100)
    target_type = models.ForeignKey(
        ContentType, on_delete=models.SET_NULL, null=True, blank=True,
    )
    target_id = models.UUIDField(null=True, blank=True)
    target_display = models.CharField(max_length=255, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    extra_data = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['actor', 'action']),
            models.Index(fields=['target_type', 'target_id']),
        ]

    def __str__(self):
        return f'{self.actor_display} — {self.action}'


# Technical/system events only. Visible to superuser ONLY.
# Immutable — no updated_at. Never edited.

class SystemLog(models.Model):
    class Level(models.TextChoices):
        DEBUG    = 'debug',    'Debug'
        INFO     = 'info',     'Info'
        WARNING  = 'warning',  'Warning'
        ERROR    = 'error',    'Error'
        CRITICAL = 'critical', 'Critical'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    level = models.CharField(max_length=10, choices=Level.choices)
    source = models.CharField(max_length=100)
    message = models.TextField()
    extra_data = models.JSONField(null=True, blank=True)
    related_member = models.ForeignKey(
        'accounts.Member', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='system_logs',
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.level.upper()}] {self.source}: {self.message[:60]}'
