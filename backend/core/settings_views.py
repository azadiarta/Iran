import os

import django
from django.conf import settings as django_settings
from django.db import connection
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from accounts.models import AccessGroup, Member
from accounts.permissions import IsSuperuser
from core.models import DefaultSetting
from core.serializers import DefaultSettingSerializer
from core.utils import api_error, api_success
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


def _validate_value(key, value):
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
    elif key == 'max_receipt_image_size_mb':
        if not value.isdigit() or int(value) <= 0:
            return 'Must be a positive integer.'
    elif key in _CHOICES:
        if value not in _CHOICES[key]:
            return f"Must be one of: {', '.join(_CHOICES[key])}."
    return None


def _get_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    return forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')


class DefaultSettingListView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser]

    def get(self, request):
        settings = DefaultSetting.objects.select_related('updated_by').all()
        return api_success(DefaultSettingSerializer(settings, many=True).data)


class DefaultSettingUpdateView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser]

    def patch(self, request, key):
        try:
            setting = DefaultSetting.objects.get(key=key)
        except DefaultSetting.DoesNotExist:
            return api_error('Setting not found.', status_code=404)

        new_value = request.data.get('value')
        if new_value is None:
            return api_error('value is required.', errors={'value': ['This field is required.']})

        new_value = str(new_value).strip()
        error = _validate_value(key, new_value)
        if error:
            return api_error('Validation failed.', errors={'value': [error]})

        old_value = setting.value
        setting.value = new_value
        setting.updated_by = request.user
        setting.save(update_fields=['value', 'updated_by', 'updated_at'])

        ActivityLog.objects.create(
            actor=request.user,
            actor_display=str(request.user),
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
