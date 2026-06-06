import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models


class MemberManager(BaseUserManager):
    def create_user(self, password=None, **extra_fields):
        member = self.model(**extra_fields)
        member.set_password(password)
        member.save(using=self._db)
        return member

    def create_superuser(self, email, password, **extra_fields):
        # Superuser created ONLY via terminal: python manage.py createsuperuser
        # No API endpoint exists to create or modify superuser.
        # No member — regardless of permissions — can delete or modify superuser.
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('full_name', email.split('@')[0])
        return self.create_user(email=email, password=password, **extra_fields)


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


# Login accepts phone OR email — MemberAuthBackend resolves both.
# email/phone stored as NULL (not '') when not provided — required for unique constraint.
# clean(): at least one of phone/email required.
class Member(AbstractBaseUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=35)
    display_name = models.CharField(max_length=20, blank=True)
    group = models.ForeignKey(
        AccessGroup, on_delete=models.PROTECT,
        related_name='members', null=True, blank=True,
    )
    phone = models.CharField(max_length=20, unique=True, null=True, blank=True, default=None)
    email = models.EmailField(unique=True, null=True, blank=True, default=None)
    # password field provided by AbstractBaseUser (set via set_password())
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = MemberManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        ordering = ['full_name']

    def clean(self):
        if not self.phone and not self.email:
            raise ValidationError('At least one of phone or email must be provided.')

    def has_perm(self, perm, obj=None):
        return self.is_superuser

    def has_module_perms(self, app_label):
        return self.is_superuser

    def __str__(self):
        return self.display_name or self.full_name
