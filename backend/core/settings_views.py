import os

import django
from django.conf import settings as django_settings
from django.db import connection
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from rest_framework.exceptions import ValidationError as DRFValidationError

from accounts.models import AccessGroup, Member
from accounts.permissions import IsSuperuser
from core.lockdown import LOCKDOWN_KEYS
from core.log_utils import actor_display_for
from core.models import DefaultSetting
from core.serializers import DefaultSettingSerializer
from core.utils import api_error, api_success
from core.validators import (
    LONG_TEXT_ADMIN_MAX_LENGTH,
    SHORT_TEXT_ADMIN_MAX_LENGTH,
    sanitize_text,
    validate_email_format,
    validate_phone_format,
)
from fund.models import Contribution, Expense
from logs.models import ActivityLog
from posts.models import Comment, Post

# Validation rules per key
_CHOICES = {
    'require_comment_approval':  ['true', 'false'],
    'expense_list_visibility':   ['all', 'members_only', 'admin_only'],
    'post_list_visibility':      ['all', 'members_only', 'group_based'],
    'member_profile_visibility': ['all', 'members_only', 'group_based'],
}

# Keys whose value must be a well-formed email/phone, beyond the generic
# length+sanitization check applied to every setting below.
_EMAIL_KEYS = ('contact_email', 'payment_paypal_email')
_PHONE_KEYS = ('contact_phone',)

# Every general/payment setting is a single-line value (SHORT_TEXT_ADMIN_MAX_LENGTH)
# except these two free-text instructions fields, which are genuinely
# multi-line and editable via an AdminTextarea on the frontend — they alone
# get the LONG_TEXT_ADMIN_MAX_LENGTH ceiling. Keys not listed here that need
# something other than the short-text default (e.g. the landing headline/
# tagline, longer than 100 but still far short of 550) get their own entry
# in _LENGTH_OVERRIDES instead.
_LONG_TEXT_KEYS = ('payment_manual_instructions', 'payment_paypal_instructions')
_LENGTH_OVERRIDES = {
    'landing_headline_en': 150,
    'landing_headline_fa': 150,
    'landing_tagline_en': 300,
    'landing_tagline_fa': 300,
}


def _validate_value(key, value):
    if key in _LONG_TEXT_KEYS:
        max_length = LONG_TEXT_ADMIN_MAX_LENGTH
    else:
        max_length = _LENGTH_OVERRIDES.get(key, SHORT_TEXT_ADMIN_MAX_LENGTH)
    if len(value) > max_length:
        return f'Must be {max_length} characters or fewer.'
    if key == 'default_group':
        try:
            import uuid
            uid = uuid.UUID(value)
        except (ValueError, AttributeError):
            return 'Must be a valid UUID.'
        if not AccessGroup.objects.filter(pk=uid).exists():
            return 'No group with that ID exists.'
    elif key == 'default_currency':
        if len(value) > 3:
            return 'Must be at most 3 characters.'
    elif key in ('max_receipt_image_size_mb', 'auth_sync_interval_seconds'):
        if not value.isdigit() or int(value) <= 0:
            return 'Must be a positive integer.'
    elif key in _CHOICES:
        if value not in _CHOICES[key]:
            return f"Must be one of: {', '.join(_CHOICES[key])}."
    elif key in _EMAIL_KEYS:
        if value:
            try:
                validate_email_format(value)
            except DRFValidationError as exc:
                return str(exc.detail[0]) if isinstance(exc.detail, list) else str(exc.detail)
    elif key in _PHONE_KEYS:
        if value:
            try:
                validate_phone_format(value)
            except DRFValidationError as exc:
                return str(exc.detail[0]) if isinstance(exc.detail, list) else str(exc.detail)
    return None


def _get_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    return forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')


class DefaultSettingListView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser]

    def get(self, request):
        # Lockdown keys are deliberately excluded — they're only ever
        # written through core.lockdown_views, never this generic endpoint.
        settings = DefaultSetting.objects.exclude(key__in=LOCKDOWN_KEYS).select_related('updated_by').all()
        return api_success(DefaultSettingSerializer(settings, many=True).data)


# Settings safe to expose to anyone, including guests (e.g. for the public
# Contact Us page) — deliberately a tiny allowlist, never the full settings list.
PUBLIC_SETTING_KEYS = [
    'contact_email', 'contact_phone', 'auth_sync_interval_seconds',
    'landing_headline_en', 'landing_headline_fa', 'landing_tagline_en', 'landing_tagline_fa',
]


class PublicSettingListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        settings = DefaultSetting.objects.filter(key__in=PUBLIC_SETTING_KEYS)
        data = [{'key': s.key, 'value': s.value} for s in settings]
        return api_success(data)


class DefaultSettingUpdateView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser]

    def patch(self, request, key):
        if key in LOCKDOWN_KEYS:
            return api_error('Setting not found.', status_code=404)

        try:
            setting = DefaultSetting.objects.get(key=key)
        except DefaultSetting.DoesNotExist:
            return api_error('Setting not found.', status_code=404)

        new_value = request.data.get('value')
        if new_value is None:
            return api_error('value is required.', errors={'value': ['This field is required.']})

        new_value = sanitize_text(str(new_value))
        error = _validate_value(key, new_value)
        if error:
            return api_error('Validation failed.', errors={'value': [error]})

        old_value = setting.value
        setting.value = new_value
        setting.updated_by = request.user
        setting.save(update_fields=['value', 'updated_by', 'updated_at'])

        ActivityLog.objects.create(
            actor=request.user,
            actor_display=actor_display_for(request.user),
            action='setting_updated',
            ip_address=_get_ip(request),
            extra_data={'key': key, 'old_value': old_value, 'new_value': new_value},
        )
        return api_success(DefaultSettingSerializer(setting).data, message='Setting updated.')


class SystemStatusView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser]

    def get(self, request):
        engine = django_settings.DATABASES['default']['ENGINE'].rsplit('.', 1)[-1]

        try:
            connection.ensure_connection()
            db_connected = True
        except Exception:
            db_connected = False

        data = {
            'database': {
                'engine': engine,
                'connected': db_connected,
            },
            'debug': django_settings.DEBUG,
            'environment': 'railway' if os.environ.get('RAILWAY_ENVIRONMENT') else 'local',
            'media_storage': 's3' if django_settings.AWS_STORAGE_BUCKET_NAME else 'local',
            'django_version': django.get_version(),
            'counts': {
                'members_total': Member.objects.count(),
                'members_active': Member.objects.filter(is_active=True).count(),
                'posts': Post.objects.count(),
                'contributions': Contribution.objects.count(),
                'expenses': Expense.objects.count(),
                'pending_comments': Comment.objects.filter(status=Comment.Status.PENDING).count(),
            },
        }
        return api_success(data)
