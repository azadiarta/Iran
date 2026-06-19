import uuid
from django.db import models

from core.tracking_codes import generate_tracking_code


class Contribution(models.Model):
    class PaymentMethod(models.TextChoices):
        STRIPE     = 'stripe',     'Stripe'
        PAYPAL     = 'paypal',     'PayPal'
        GOOGLE_PAY = 'google_pay', 'Google Pay'
        MANUAL     = 'manual',     'Manual'
        OTHER      = 'other',      'Other'

    class Status(models.TextChoices):
        PENDING        = 'pending',        'Pending'
        PENDING_REVIEW = 'pending_review', 'Pending Review'
        COMPLETED      = 'completed',      'Completed'
        FAILED         = 'failed',         'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # System-assigned lookup code (never user-supplied), admin-panel-only —
    # see save()/core/tracking_codes.py. Format matches Comment and
    # ContactMessage's tracking_code (letter 'F' for Fund contribution).
    tracking_code = models.CharField(max_length=20, unique=True, editable=False, blank=True)
    contributor = models.ForeignKey(
        'accounts.Member', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='contributions',
    )
    guest_name = models.CharField(max_length=50, blank=True)
    amount = models.DecimalField(max_digits=11, decimal_places=2)
    currency = models.CharField(max_length=3, default='GBP')
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    notes = models.TextField(blank=True)
    receipt_image = models.ImageField(upload_to='contribution_receipts/', blank=True)

    class DisplayNameChoice(models.TextChoices):
        HIDDEN       = 'hidden',       'Hidden'
        DISPLAY_NAME = 'display_name', 'Display Name'
        FULL_NAME    = 'full_name',    'Full Name'
        CUSTOM       = 'custom',       'Custom'

    show_in_public_list = models.BooleanField(default=False)
    display_name_choice = models.CharField(
        max_length=20, choices=DisplayNameChoice.choices, default=DisplayNameChoice.DISPLAY_NAME,
    )
    public_display_name = models.CharField(max_length=100, blank=True)
    message = models.CharField(max_length=150, blank=True)
    rejection_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.tracking_code:
            member_number = self.contributor.member_number if self.contributor_id else None
            self.tracking_code = generate_tracking_code(Contribution, 'F', member_number)
        super().save(*args, **kwargs)

    def __str__(self):
        name = (
            self.contributor.display_name or self.contributor.full_name
            if self.contributor
            else (self.guest_name or 'Guest')
        )
        return f'{name} — {self.amount} {self.currency}'


class Expense(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    withdrawn_by = models.ForeignKey(
        'accounts.Member', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='expenses',
    )
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
