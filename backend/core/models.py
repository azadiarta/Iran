import uuid
from django.db import models


# Default seed codenames: can_contribute (ON), can_comment (ON), can_post,
# can_expense, can_manage_permissions, can_approve_comments,
# can_view_balance (label: 'Can view fund balance')

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


# Default seeds (set via Django admin by superuser):
#   default_group = <UUID of AccessGroup with is_default=True>
#   default_currency = GBP
#   require_comment_approval = true
#   max_receipt_image_size_mb = 5
#   expense_list_visibility = members_only
#   post_list_visibility = members_only
#   member_profile_visibility = members_only
#
# Payment: Manual Bank Transfer
#   payment_manual_enabled = false
#   payment_manual_bank_name =
#   payment_manual_account_name =
#   payment_manual_account_number =
#   payment_manual_sort_code =
#   payment_manual_reference_prefix = FUND-
#   payment_manual_instructions =
#
# Payment: PayPal (Personal / Sole Trader — no API, manual send)
#   payment_paypal_enabled = false
#   payment_paypal_email =
#   payment_paypal_me_link =
#   payment_paypal_instructions =
#
# Future (keys reserved — do not use yet):
#   payment_stripe_enabled = false
#   payment_stripe_public_key =
#   payment_stripe_secret_key =
#   payment_stripe_webhook_secret =
#   payment_google_pay_enabled = false

class DefaultSetting(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()
    description = models.CharField(max_length=350, blank=True)
    updated_by = models.ForeignKey(
        'accounts.Member', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='setting_changes',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.key} = {self.value}'


# Runtime overrides for OS-level env vars (admin "Environment Variables" panel).
# A row only exists when an admin has changed that key from its auto-detected
# default; "reset to default" simply deletes the row. See core.runtime_config
# for the registry of manageable keys and core.middleware for how these are
# applied to live settings.

class EnvVarOverride(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()
    section = models.CharField(max_length=50)
    requires_restart = models.BooleanField(default=False)
    is_enabled = models.BooleanField(default=True)
    updated_by = models.ForeignKey(
        'accounts.Member', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='env_var_changes',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.key} = {self.value}'
