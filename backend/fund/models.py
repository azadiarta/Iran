import uuid
from django.db import models


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
    contributor = models.ForeignKey(
        'accounts.Member', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='contributions',
    )
    guest_name = models.CharField(max_length=50, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='GBP')
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    notes = models.TextField(blank=True)
    receipt_image = models.ImageField(upload_to='contribution_receipts/', blank=True)
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
