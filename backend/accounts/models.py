import logging
import random
import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models

logger = logging.getLogger(__name__)


class MemberManager(BaseUserManager):
    def create_user(self, password=None, **extra_fields):
        member = self.model(**extra_fields)
        member.set_password(password)
        member.save(using=self._db)
        return member

    def create_superuser(self, email, password, **extra_fields):
        # Superuser created ONLY via terminal: python manage.py createsuperuser
        # (or, on Railway, by setting DJANGO_SUPERUSER_EMAIL/DJANGO_SUPERUSER_PASSWORD
        # env vars — see backend/scripts/prepare.sh, which calls this idempotently
        # on every startup so no Shell access is required).
        # No API endpoint exists to create or modify superuser.
        # No member — regardless of permissions — can delete or modify superuser.
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('full_name', email.split('@')[0])
        return self.create_user(email=email, password=password, **extra_fields)


def get_default_group_id():
    try:
        group = AccessGroup.objects.filter(is_default=True).first()
        return group.id if group else None
    except Exception:
        logger.exception('Failed to resolve the default access group id')
        return None


# Baseline permissions every group/plan is expected to have by default — a
# member whose group has no permission outside this set is treated as a
# regular member (see frontend/lib/adminNav.ts BASELINE_PERMISSIONS and
# hasAdminAccess()). New groups are pre-populated with these permissions, but
# an admin may manually remove any of them from a group.
BASELINE_GROUP_PERMISSIONS = ['can_contribute', 'can_comment', 'can_view_balance', 'can_view_posts']


# Superuser bypasses ALL permission checks — never enforce group perms for superuser.
# No group can modify or delete the superuser account.
class AccessGroup(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=20, unique=True)
    description = models.CharField(max_length=350, blank=True)
    is_default = models.BooleanField(default=False)
    permissions = models.ManyToManyField('core.Permission', blank=True, related_name='groups')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def save(self, *args, **kwargs):
        if self.is_default:
            AccessGroup.objects.filter(is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)

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
        AccessGroup, on_delete=models.SET_DEFAULT,
        default=get_default_group_id,
        related_name='members', null=True, blank=True,
    )
    phone = models.CharField(max_length=20, unique=True, null=True, blank=True, default=None)
    email = models.EmailField(unique=True, null=True, blank=True, default=None)
    # 5-digit, never starts with 0, unique, immutable once assigned (see save()).
    # Lets members/admins identify someone quickly without exposing the UUID pk.
    member_number = models.PositiveIntegerField(unique=True, null=True, blank=True, editable=False)
    # password field provided by AbstractBaseUser (set via set_password())
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    # Set when an admin deactivates this member (MemberToggleActiveView);
    # cleared again on reactivation. Shown to the member on the home page.
    deactivation_reason = models.TextField(max_length=550, blank=True)
    deactivated_by = models.ForeignKey(
        'self', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+',
    )
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

    def save(self, *args, **kwargs):
        if self.member_number is None:
            self.member_number = self._generate_member_number()
        super().save(*args, **kwargs)

    @staticmethod
    def _generate_member_number():
        for _ in range(20):
            candidate = random.randint(10000, 99999)
            if not Member.objects.filter(member_number=candidate).exists():
                return candidate
        raise RuntimeError('Could not generate a unique member number.')

    def has_perm(self, perm, obj=None):
        return self.is_superuser

    def has_module_perms(self, app_label):
        return self.is_superuser

    # Member doesn't use PermissionsMixin/auth.Permission for app permissions
    # (see has_perm/has_module_perms above), but django-jazzmin's admin menu
    # calls get_all_permissions() to decide what to show. Superusers see
    # everything (matching has_module_perms); everyone else sees nothing
    # extra (the admin site itself remains staff-only via has_module_perms).
    def get_user_permissions(self, obj=None):
        return set()

    def get_group_permissions(self, obj=None):
        return set()

    def get_all_permissions(self, obj=None):
        if not self.is_superuser:
            return set()
        from django.contrib.auth.models import Permission
        return {f'{p.content_type.app_label}.{p.codename}' for p in Permission.objects.all()}

    def __str__(self):
        return self.display_name or self.full_name
