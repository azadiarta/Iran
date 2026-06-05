import uuid
from django.core.exceptions import ValidationError
from django.db import models


# Superuser bypasses ALL permission checks — never enforce group perms for superuser.
# No group can modify or delete the superuser account.
# can_contribute + can_comment must be assigned to every new group by default.

class AccessGroup(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=20, unique=True)
    description = models.CharField(max_length=350, blank=True)
    permissions = models.ManyToManyField('core.Permission', blank=True, related_name='groups')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


# Passwords stored as Django-hashed strings — use make_password() at service layer.
# Login accepts phone OR email; auth backend resolves both.
# clean() enforces: at least one of phone/email required.

class Member(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=35)
    display_name = models.CharField(max_length=20, blank=True)
    group = models.ForeignKey(AccessGroup, on_delete=models.PROTECT, related_name='members')
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    password = models.CharField(max_length=128)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['full_name']

    def clean(self):
        if not self.phone and not self.email:
            raise ValidationError('At least one of phone or email must be provided.')

    def __str__(self):
        return self.display_name or self.full_name
