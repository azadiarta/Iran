import uuid
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


# ─── Permission ───────────────────────────────────────────────────────────────
# Seed codenames: can_contribute (ON), can_comment (ON), can_post,
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


# ─── AccessGroup ──────────────────────────────────────────────────────────────
# Superuser bypasses ALL permission checks — never enforce group perms for superuser.
# No group can modify or delete the superuser account.
# can_contribute + can_comment must be assigned to every new group by default.

class AccessGroup(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=20, unique=True)
    description = models.CharField(max_length=350, blank=True)
    permissions = models.ManyToManyField(Permission, blank=True, related_name='groups')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


# ─── Member ───────────────────────────────────────────────────────────────────
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


# ─── Contribution ─────────────────────────────────────────────────────────────
# contributor null → guest. guest_name used when contributor is null.

class Contribution(models.Model):
    class PaymentMethod(models.TextChoices):
        STRIPE     = 'stripe',     'Stripe'
        PAYPAL     = 'paypal',     'PayPal'
        GOOGLE_PAY = 'google_pay', 'Google Pay'
        MANUAL     = 'manual',     'Manual'
        OTHER      = 'other',      'Other'

    class Status(models.TextChoices):
        PENDING   = 'pending',   'Pending'
        COMPLETED = 'completed', 'Completed'
        FAILED    = 'failed',    'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contributor = models.ForeignKey(
        Member, on_delete=models.SET_NULL, null=True, blank=True, related_name='contributions'
    )
    guest_name = models.CharField(max_length=50, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='GBP')
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        name = (
            self.contributor.display_name or self.contributor.full_name
            if self.contributor
            else (self.guest_name or 'Guest')
        )
        return f'{name} — {self.amount} {self.currency}'


# ─── Expense ──────────────────────────────────────────────────────────────────

class Expense(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    withdrawn_by = models.ForeignKey(Member, on_delete=models.PROTECT, related_name='expenses')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    short_reason = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    receipt_image = models.ImageField(upload_to='receipts/', blank=True)
    expense_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-expense_date']

    def __str__(self):
        return f'{self.short_reason} — {self.amount}'


# ─── Post + PostImage ─────────────────────────────────────────────────────────

class Post(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(Member, on_delete=models.PROTECT, related_name='posts')
    title = models.CharField(max_length=150)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class PostImage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='posts/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Image → {self.post.title}'


# ─── Comment ──────────────────────────────────────────────────────────────────
# Generic FK targets Post or Expense.
# ALL comments (member AND guest) require approval before display — is_approved=False default.

class Comment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(
        Member, on_delete=models.SET_NULL, null=True, blank=True, related_name='comments'
    )
    guest_name = models.CharField(max_length=50, blank=True)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField()
    content_object = GenericForeignKey('content_type', 'object_id')
    text = models.TextField()
    rating = models.IntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(10)],
    )
    is_approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['content_type', 'object_id'])]

    def __str__(self):
        name = (
            self.author.display_name or self.author.full_name
            if self.author
            else (self.guest_name or 'Guest')
        )
        return f'{name} on {self.content_type} #{self.object_id}'


# ─── ActivityLog ──────────────────────────────────────────────────────────────
# Immutable — no updated_at. Tracks every user-initiated action.
# actor_display + target_display are snapshots at action time (survive deletions).
# Superuser sees all; group admins see scoped subset per access rules.
# action values: created_post, deleted_comment, changed_permission, login, logout,
#   failed_login, contributed, added_expense, approved_comment, edited_post,
#   deleted_post, changed_group, created_member, deactivated_member

class ActivityLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        Member, on_delete=models.SET_NULL, null=True, blank=True, related_name='activity_logs'
    )
    actor_display = models.CharField(max_length=100)
    action = models.CharField(max_length=100)
    target_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True, blank=True)
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


# ─── SystemLog ────────────────────────────────────────────────────────────────
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
        Member, on_delete=models.SET_NULL, null=True, blank=True, related_name='system_logs'
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.level.upper()}] {self.source}: {self.message[:60]}'
