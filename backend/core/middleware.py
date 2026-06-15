import json
import time

from django.conf import settings

# Process-local cache of EnvVarOverride rows for the "live" category keys,
# refreshed at most once every TTL seconds. A try/except around the query
# means a transient DB issue simply keeps the previous (or default) values in
# effect instead of breaking every request.
_TTL = 30
_cache = {'data': {}, 'expires_at': 0}

_LIVE_KEYS = ('DEBUG', 'ALLOWED_HOSTS_EXTRA', 'CSRF_TRUSTED_ORIGINS_EXTRA', 'CORS_ALLOWED_ORIGINS_EXTRA')


def _load_overrides():
    from core.models import EnvVarOverride
    overrides = {}
    try:
        for row in EnvVarOverride.objects.filter(is_enabled=True, key__in=_LIVE_KEYS):
            overrides[row.key] = row.value
    except Exception:
        pass
    return overrides


class RuntimeConfigMiddleware:
    """Applies admin-configured overrides for the "live" env vars on top of
    AUTO_DETECTED_DEFAULTS (see groupfund.settings) on every request.

    Only ever *appends* to the auto-detected ALLOWED_HOSTS / CSRF_TRUSTED_ORIGINS
    / CORS_ALLOWED_ORIGINS lists, and DEBUG falls back to its auto-detected value
    when no override exists -- so a bad override can never lock the admin panel
    out of its own settings page.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        self._apply()
        return self.get_response(request)

    def _apply(self):
        now = time.time()
        if now >= _cache['expires_at']:
            _cache['data'] = _load_overrides()
            _cache['expires_at'] = now + _TTL

        overrides = _cache['data']
        defaults = settings.AUTO_DETECTED_DEFAULTS

        if 'DEBUG' in overrides:
            settings.DEBUG = overrides['DEBUG'] == 'True'
        else:
            settings.DEBUG = defaults['DEBUG']

        for override_key, default_key, setting_name in (
            ('ALLOWED_HOSTS_EXTRA', 'ALLOWED_HOSTS', 'ALLOWED_HOSTS'),
            ('CSRF_TRUSTED_ORIGINS_EXTRA', 'CSRF_TRUSTED_ORIGINS', 'CSRF_TRUSTED_ORIGINS'),
            ('CORS_ALLOWED_ORIGINS_EXTRA', 'CORS_ALLOWED_ORIGINS', 'CORS_ALLOWED_ORIGINS'),
        ):
            base = list(defaults[default_key])
            extra = []
            if override_key in overrides:
                try:
                    extra = json.loads(overrides[override_key])
                except (ValueError, TypeError):
                    extra = []
            setattr(settings, setting_name, base + [e for e in extra if e and e not in base])
