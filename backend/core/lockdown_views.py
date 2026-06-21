from django.db import transaction
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from accounts.permissions import HasGroupPermission, IsSuperuser
from core.lockdown import (
    PERMISSION_ENABLED_KEY,
    PERMISSION_MESSAGE_KEY,
    SUPERUSER_ENABLED_KEY,
    SUPERUSER_MESSAGE_KEY,
    get_lockdown_state,
)
from core.log_utils import actor_display_for
from core.models import DefaultSetting
from core.utils import api_error, api_success
from core.validators import LONG_TEXT_ADMIN_MAX_LENGTH, sanitize_and_limit
from logs.models import ActivityLog


def _log(actor, action, extra_data=None, ip=None):
    ActivityLog.objects.create(
        actor=actor,
        actor_display=actor_display_for(actor),
        action=action,
        ip_address=ip,
        extra_data=extra_data,
    )


def _get_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    return forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')


def _set_setting(key, value, user):
    DefaultSetting.objects.update_or_create(key=key, defaults={'value': value, 'updated_by': user})


class LockdownStatusView(APIView):
    """Public — the frontend gate (and anonymous visitors) need this with no auth."""
    permission_classes = [AllowAny]

    def get(self, request):
        kind, message = get_lockdown_state()
        return api_success({'kind': kind, 'message': message})


class SuperuserLockdownToggleView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser]

    @transaction.atomic
    def patch(self, request, pk=None):
        enabled = bool(request.data.get('enabled'))

        if enabled:
            raw_message = str(request.data.get('message') or '')
            try:
                message = sanitize_and_limit(raw_message, LONG_TEXT_ADMIN_MAX_LENGTH)
            except DRFValidationError as exc:
                detail = exc.detail[0] if isinstance(exc.detail, list) else exc.detail
                return api_error(str(detail), errors={'message': [str(detail)]})
            if not message:
                return api_error('A message is required to enable lockdown.',
                                  errors={'message': ['This field is required.']})

            # Priority rule: superuser-kind lockdown always wins over the
            # permission-kind one — force the latter off (persisted, not just
            # shadowed by evaluation order) so it doesn't silently "reactivate"
            # whenever this one is later turned back off.
            permission_was_on = DefaultSetting.objects.filter(
                key=PERMISSION_ENABLED_KEY, value='true',
            ).exists()
            if permission_was_on:
                _set_setting(PERMISSION_ENABLED_KEY, 'false', request.user)
                _set_setting(PERMISSION_MESSAGE_KEY, '', request.user)
                _log(request.user, 'permission_lockdown_auto_disabled', ip=_get_ip(request))

            _set_setting(SUPERUSER_ENABLED_KEY, 'true', request.user)
            _set_setting(SUPERUSER_MESSAGE_KEY, message, request.user)
            _log(request.user, 'superuser_lockdown_enabled', extra_data={'message': message}, ip=_get_ip(request))
        else:
            _set_setting(SUPERUSER_ENABLED_KEY, 'false', request.user)
            _set_setting(SUPERUSER_MESSAGE_KEY, '', request.user)
            _log(request.user, 'superuser_lockdown_disabled', ip=_get_ip(request))

        kind, message = get_lockdown_state()
        return api_success({'kind': kind, 'message': message}, message='Lockdown updated.')


class PermissionLockdownToggleView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_toggle_lockdown')]

    def patch(self, request, pk=None):
        enabled = bool(request.data.get('enabled'))

        if enabled:
            existing_kind, _ = get_lockdown_state()
            if existing_kind == 'superuser':
                return api_error(
                    'Site-wide superuser lockdown is already active — this toggle has no effect '
                    'until it is turned off.',
                    status_code=409,
                )

            raw_message = str(request.data.get('message') or '')
            try:
                message = sanitize_and_limit(raw_message, LONG_TEXT_ADMIN_MAX_LENGTH)
            except DRFValidationError as exc:
                detail = exc.detail[0] if isinstance(exc.detail, list) else exc.detail
                return api_error(str(detail), errors={'message': [str(detail)]})
            if not message:
                return api_error('A message is required to enable lockdown.',
                                  errors={'message': ['This field is required.']})

            _set_setting(PERMISSION_ENABLED_KEY, 'true', request.user)
            _set_setting(PERMISSION_MESSAGE_KEY, message, request.user)
            _log(request.user, 'permission_lockdown_enabled', extra_data={'message': message}, ip=_get_ip(request))
        else:
            _set_setting(PERMISSION_ENABLED_KEY, 'false', request.user)
            _set_setting(PERMISSION_MESSAGE_KEY, '', request.user)
            _log(request.user, 'permission_lockdown_disabled', ip=_get_ip(request))

        kind, message = get_lockdown_state()
        return api_success({'kind': kind, 'message': message}, message='Lockdown updated.')
