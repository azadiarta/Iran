import uuid
from django.db import models


# Default seed codenames: can_contribute (ON), can_comment (ON), can_post,
# can_expense, can_manage_permissions, can_approve_comments

class Permission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    codename = models.CharField(max_length=50, unique=True)
    label = models.CharField(max_length=100)
    description = models.CharField(max_length=350, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['codename']

    def __str__(self):
        return self.label
