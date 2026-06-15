import json

from django.core.management.utils import get_random_secret_key
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from accounts.permissions import HasGroupPermission
from core import middleware as runtime_middleware
from core.models import EnvVarOverride
from core.runtime_config import ENV_VAR_REGISTRY, get_source
from core.utils import api_error, api_success
from logs.models import ActivityLog

_PERMISSION = HasGroupPermission('can_manage_env_vars')


def _get_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    return forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')


def _log(request, action, key, old, new):
    ActivityLog.objects.create(
        actor=request.user,
        actor_display=str(request.user),
        action=action,
        ip_address=_get_ip(request),
        extra_data={'key': key, 'old': old, 'new': new},
    )


def _bust_cache():
    # Live keys are polled on a 30s TTL by RuntimeConfigMiddleware -- force an
    # immediate refresh on the next request so admin changes feel instant.
    runtime_middleware._cache['expires_at'] = 0


def _serialize(key):
    meta = ENV_VAR_REGISTRY[key]
    entry = {
        'key': key,
        'section': meta['section'],
        'category': meta['category'],
        'value_type': meta['value_type'],
        'requires_restart': meta['requires_restart'],
        'source': get_source(key),
        'value': meta['current'](),
    }
    if 'base' in meta:
        entry['base'] = meta['base']()
    return entry


class EnvVarListView(APIView):
    permission_classes = [IsAuthenticated, _PERMISSION]

    def get(self, request):
        return api_success([_serialize(key) for key in ENV_VAR_REGISTRY])


class EnvVarUpdateView(APIView):
    permission_classes = [IsAuthenticated, _PERMISSION]

    def patch(self, request, key):
        meta = ENV_VAR_REGISTRY.get(key)
        if meta is None:
            return api_error('Unknown key.', status_code=404)
        if meta['category'] == 'readonly':
            return api_error('This setting is read-only and cannot be changed here.', status_code=400)

        old_value = meta['current']()
        value_type = meta['value_type']

        if value_type == 'bool':
            new_value = request.data.get('value')
            if not isinstance(new_value, bool):
                return api_error('value must be a boolean.', errors={'value': ['This field must be true or false.']})
            stored_value = 'True' if new_value else 'False'
            display_value = new_value

        elif value_type == 'csv_extra':
            new_value = request.data.get('value')
            if not isinstance(new_value, list) or not all(isinstance(v, str) for v in new_value):
                return api_error('value must be a list of strings.', errors={'value': ['This field must be a list of strings.']})
            base = meta['base']()
            cleaned = []
            for item in new_value:
                item = item.strip()
                if not item:
                    continue
                if item == '*':
                    return api_error("'*' is not allowed here.", errors={'value': ["'*' is not allowed -- it would match every host/origin."]})
                if item in base:
                    return api_error(f'"{item}" is already covered by the auto-detected defaults.', errors={'value': [f'"{item}" is already covered by the auto-detected defaults.']})
                if item not in cleaned:
                    cleaned.append(item)
            stored_value = json.dumps(cleaned)
            display_value = cleaned

        elif value_type in ('string', 'secret'):
            new_value = request.data.get('value')
            if not isinstance(new_value, str):
                return api_error('value must be a string.', errors={'value': ['This field must be a string.']})
            stored_value = new_value
            display_value = new_value

        elif value_type == 'secret_regenerate':
            if not request.data.get('confirm'):
                return api_error('Confirmation required to regenerate the secret key.', errors={'confirm': ['This field is required.']})
            stored_value = get_random_secret_key()
            display_value = '(regenerated)'

        else:
            return api_error('Unsupported value type.', status_code=400)

        override, _created = EnvVarOverride.objects.update_or_create(
            key=key,
            defaults={
                'value': stored_value,
                'section': meta['section'],
                'requires_restart': meta['requires_restart'],
                'is_enabled': True,
                'updated_by': request.user,
            },
        )

        if meta['category'] == 'live':
            _bust_cache()

        _log(request, 'env_var_updated', key, old_value, display_value)
        return api_success(_serialize(key), message='Setting updated.')


class EnvVarResetView(APIView):
    permission_classes = [IsAuthenticated, _PERMISSION]

    def post(self, request, key):
        meta = ENV_VAR_REGISTRY.get(key)
        if meta is None:
            return api_error('Unknown key.', status_code=404)

        old_value = meta['current']()
        deleted, _ = EnvVarOverride.objects.filter(key=key).delete()
        if meta['category'] == 'live':
            _bust_cache()

        if deleted:
            _log(request, 'env_var_reset', key, old_value, meta['current']())
        return api_success(_serialize(key), message='Reset to default.')


class EnvVarResetAllView(APIView):
    permission_classes = [IsAuthenticated, _PERMISSION]

    def post(self, request):
        keys = list(EnvVarOverride.objects.values_list('key', flat=True))
        EnvVarOverride.objects.all().delete()
        _bust_cache()

        if keys:
            ActivityLog.objects.create(
                actor=request.user,
                actor_display=str(request.user),
                action='env_var_reset_all',
                ip_address=_get_ip(request),
                extra_data={'keys': keys},
            )
        return api_success([_serialize(key) for key in ENV_VAR_REGISTRY], message='All settings reset to default.')
