from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import BASELINE_GROUP_PERMISSIONS, AccessGroup
from core.models import DefaultSetting, Permission

# codename -> (label, description)
PERMISSIONS = {
    'can_contribute':         ('Can Contribute', 'Submit financial contributions to the fund.'),
    'can_comment':            ('Can Comment', 'Post comments on posts and expenses.'),
    'can_post':               ('Can Post', 'Create, edit and delete posts and post images.'),
    'can_expense':            ('Can Record Expenses', 'Record fund expenses/withdrawals.'),
    'can_view_balance':       ('Can View Fund Balance', 'View the current fund balance.'),
    'can_view_posts':         ('Can View Posts', 'View posts when post visibility is restricted to members.'),
    'can_view_dashboard':     ('Can View Dashboard', 'Access the admin dashboard overview and stats.'),
    'can_approve_comments':   ('Can Approve Comments', 'Approve, reject or delete pending comments.'),
    'can_delete_member':      ('Can Delete Members', 'Deactivate or remove member accounts.'),
    'can_change_any_password':('Can Change Any Password', "Change another member's password."),
    'can_manage_permissions': ('Can Manage Permissions', 'Full admin access: members, groups, permissions, settings, payments and content moderation.'),
    'can_manage_contact_messages': ('Can Manage Contact Messages', 'View submitted contact form messages and mark them as handled.'),
    'can_view_member_details': ('Can View Member Details', "View a member's full profile: their comments, contributions, contact messages and activity."),
}

# The default group (assigned to newly registered members) gets the same
# baseline permissions every group/plan is expected to have by default — see
# accounts.models.BASELINE_GROUP_PERMISSIONS.
DEFAULT_GROUP_NAME = 'Members'
DEFAULT_GROUP_PERMISSIONS = BASELINE_GROUP_PERMISSIONS

# key -> (default value, description)
DEFAULT_SETTINGS = {
    'default_currency':            ('GBP', 'ISO currency code used across the fund (max 3 characters).'),
    'require_comment_approval':    ('true', 'Whether new comments must be approved by a moderator before becoming visible (true/false).'),
    'max_receipt_image_size_mb':   ('5', 'Maximum upload size in megabytes for contribution/expense receipt images.'),
    'expense_list_visibility':     ('members_only', 'Who can view the expenses list: all, members_only, admin_only.'),
    'post_list_visibility':        ('members_only', 'Who can view posts: all, members_only, group_based.'),
    'member_profile_visibility':   ('members_only', 'Who can view member profiles: all, members_only, group_based.'),

    'contact_email':               ('', 'Public contact email shown on the Contact Us page.'),
    'contact_phone':               ('', 'Public contact phone number shown on the Contact Us page.'),

    'payment_manual_enabled':         ('false', 'Whether the manual bank transfer payment method is available.'),
    'payment_manual_bank_name':       ('', 'Bank name shown to contributors for manual bank transfers.'),
    'payment_manual_account_name':    ('', 'Account holder name shown to contributors for manual bank transfers.'),
    'payment_manual_account_number':  ('', 'Account number shown to contributors for manual bank transfers.'),
    'payment_manual_sort_code':       ('', 'Sort code shown to contributors for manual bank transfers.'),
    'payment_manual_reference_prefix':('FUND-', 'Prefix used to generate payment reference codes for manual transfers.'),
    'payment_manual_instructions':    ('', 'Extra instructions shown to contributors for manual bank transfers.'),

    'payment_paypal_enabled':      ('false', 'Whether the PayPal (manual send) payment method is available.'),
    'payment_paypal_email':        ('', 'PayPal email shown to contributors.'),
    'payment_paypal_me_link':      ('', 'paypal.me link shown to contributors.'),
    'payment_paypal_instructions': ('', 'Extra instructions shown to contributors for PayPal payments.'),

    # Reserved for Phase 10 (Stripe / Google Pay) — not used yet.
    'payment_stripe_enabled':        ('false', 'Reserved for future Stripe integration — do not enable yet.'),
    'payment_stripe_public_key':     ('', 'Reserved for future Stripe integration.'),
    'payment_stripe_secret_key':     ('', 'Reserved for future Stripe integration.'),
    'payment_stripe_webhook_secret': ('', 'Reserved for future Stripe integration.'),
    'payment_google_pay_enabled':    ('false', 'Reserved for future Google Pay integration — do not enable yet.'),
}


class Command(BaseCommand):
    help = (
        'Idempotently seeds the Permission rows, default AccessGroup and DefaultSetting '
        'rows that the application expects to exist. Safe to run on every deploy '
        '(existing rows are left untouched aside from label/description backfills).'
    )

    @transaction.atomic
    def handle(self, *args, **options):
        for codename, (label, description) in PERMISSIONS.items():
            permission, created = Permission.objects.get_or_create(
                codename=codename, defaults={'label': label, 'description': description},
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created permission: {codename}'))
            elif permission.label != label or permission.description != description:
                permission.label = label
                permission.description = description
                permission.save(update_fields=['label', 'description'])
                self.stdout.write(f'Updated permission label/description: {codename}')

        default_group = AccessGroup.objects.filter(is_default=True).first()
        if default_group is None:
            default_group, created = AccessGroup.objects.get_or_create(
                name=DEFAULT_GROUP_NAME,
                defaults={'description': 'Default group assigned to newly registered members.', 'is_default': True},
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created default access group: {default_group.name}'))
            elif not default_group.is_default:
                default_group.is_default = True
                default_group.save(update_fields=['is_default'])

        existing_codenames = set(default_group.permissions.values_list('codename', flat=True))
        missing_codenames = [c for c in DEFAULT_GROUP_PERMISSIONS if c not in existing_codenames]
        if missing_codenames:
            default_group.permissions.add(*Permission.objects.filter(codename__in=missing_codenames))
            self.stdout.write(f'Granted {missing_codenames} to "{default_group.name}"')

        for key, (value, description) in DEFAULT_SETTINGS.items():
            _, created = DefaultSetting.objects.get_or_create(
                key=key, defaults={'value': value, 'description': description},
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created setting: {key} = {value!r}'))

        if not DefaultSetting.objects.filter(key='default_group').exists():
            DefaultSetting.objects.create(
                key='default_group',
                value=str(default_group.id),
                description='UUID of the AccessGroup automatically assigned to newly registered members.',
            )
            self.stdout.write(self.style.SUCCESS(f'Created setting: default_group = {default_group.id}'))

        self.stdout.write(self.style.SUCCESS('Seed complete.'))
