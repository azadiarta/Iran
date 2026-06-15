"""Single source of truth for the admin "Environment Variables" panel.

Each entry in ENV_VAR_REGISTRY describes one manageable setting:

- section:          UI grouping key (matches frontend/lib/envVarsMeta.ts).
- category:         'live'     -- applied within ~30s by RuntimeConfigMiddleware,
                                   append-only, can never lock out the admin panel.
                     'restart'  -- stored in EnvVarOverride but only takes effect
                                   after the process restarts (shown with a badge).
                     'readonly' -- informational only, no EnvVarOverride row.
- value_type:       'bool' | 'csv_extra' | 'string' | 'secret' | 'secret_regenerate'
- requires_restart: bool, surfaced to the frontend as a badge.
- env_name:         the OS environment variable name this maps to, or None for
                     synthetic *_EXTRA keys that have no direct env var.
- current:          zero-arg callable returning the *current effective* value
                     (after AUTO_DETECTED_DEFAULTS + override are applied).
"""
import os

from django.conf import settings


def _mask(value):
    if not value:
        return value
    if len(value) <= 4:
        return '*' * len(value)
    return value[:2] + '*' * (len(value) - 4) + value[-2:]


def _database_info():
    db = settings.DATABASES['default']
    engine = db.get('ENGINE', '').rsplit('.', 1)[-1]
    if engine == 'sqlite3':
        return f'sqlite3: {db.get("NAME")}'
    return (
        f'{engine}://{db.get("USER", "")}:{_mask(db.get("PASSWORD", ""))}'
        f'@{db.get("HOST", "")}:{db.get("PORT", "")}/{db.get("NAME", "")}'
    )


def _allowed_hosts_extra():
    base = settings.AUTO_DETECTED_DEFAULTS['ALLOWED_HOSTS']
    return [h for h in settings.ALLOWED_HOSTS if h not in base]


def _csrf_trusted_origins_extra():
    base = settings.AUTO_DETECTED_DEFAULTS['CSRF_TRUSTED_ORIGINS']
    return [h for h in settings.CSRF_TRUSTED_ORIGINS if h not in base]


def _cors_allowed_origins_extra():
    base = settings.AUTO_DETECTED_DEFAULTS['CORS_ALLOWED_ORIGINS']
    return [h for h in settings.CORS_ALLOWED_ORIGINS if h not in base]


ENV_VAR_REGISTRY = {
    # ─── Live (applied within ~30s, append-only -> cannot lock out) ──────────
    'DEBUG': {
        'section': 'debug',
        'category': 'live',
        'value_type': 'bool',
        'requires_restart': False,
        'env_name': 'DEBUG',
        'current': lambda: settings.DEBUG,
    },
    'ALLOWED_HOSTS_EXTRA': {
        'section': 'hosts',
        'category': 'live',
        'value_type': 'csv_extra',
        'requires_restart': False,
        'env_name': None,
        'base': lambda: settings.AUTO_DETECTED_DEFAULTS['ALLOWED_HOSTS'],
        'current': _allowed_hosts_extra,
    },
    'CSRF_TRUSTED_ORIGINS_EXTRA': {
        'section': 'hosts',
        'category': 'live',
        'value_type': 'csv_extra',
        'requires_restart': False,
        'env_name': None,
        'base': lambda: settings.AUTO_DETECTED_DEFAULTS['CSRF_TRUSTED_ORIGINS'],
        'current': _csrf_trusted_origins_extra,
    },
    'CORS_ALLOWED_ORIGINS_EXTRA': {
        'section': 'hosts',
        'category': 'live',
        'value_type': 'csv_extra',
        'requires_restart': False,
        'env_name': None,
        'base': lambda: settings.AUTO_DETECTED_DEFAULTS['CORS_ALLOWED_ORIGINS'],
        'current': _cors_allowed_origins_extra,
    },

    # ─── Stored, needs a restart to take effect ──────────────────────────────
    'SECURE_SSL_REDIRECT': {
        'section': 'https',
        'category': 'restart',
        'value_type': 'bool',
        'requires_restart': True,
        'env_name': 'SECURE_SSL_REDIRECT',
        'current': lambda: getattr(settings, 'SECURE_SSL_REDIRECT', False),
    },
    'AWS_STORAGE_BUCKET_NAME': {
        'section': 's3',
        'category': 'restart',
        'value_type': 'string',
        'requires_restart': True,
        'env_name': 'AWS_STORAGE_BUCKET_NAME',
        'current': lambda: getattr(settings, 'AWS_STORAGE_BUCKET_NAME', ''),
    },
    'AWS_ACCESS_KEY_ID': {
        'section': 's3',
        'category': 'restart',
        'value_type': 'secret',
        'requires_restart': True,
        'env_name': 'AWS_ACCESS_KEY_ID',
        'current': lambda: _mask(getattr(settings, 'AWS_ACCESS_KEY_ID', '')),
    },
    'AWS_SECRET_ACCESS_KEY': {
        'section': 's3',
        'category': 'restart',
        'value_type': 'secret',
        'requires_restart': True,
        'env_name': 'AWS_SECRET_ACCESS_KEY',
        'current': lambda: _mask(getattr(settings, 'AWS_SECRET_ACCESS_KEY', '')),
    },
    'AWS_S3_REGION_NAME': {
        'section': 's3',
        'category': 'restart',
        'value_type': 'string',
        'requires_restart': True,
        'env_name': 'AWS_S3_REGION_NAME',
        'current': lambda: getattr(settings, 'AWS_S3_REGION_NAME', ''),
    },
    'AWS_S3_ENDPOINT_URL': {
        'section': 's3',
        'category': 'restart',
        'value_type': 'string',
        'requires_restart': True,
        'env_name': 'AWS_S3_ENDPOINT_URL',
        'current': lambda: getattr(settings, 'AWS_S3_ENDPOINT_URL', '') or '',
    },
    'AWS_S3_CUSTOM_DOMAIN': {
        'section': 's3',
        'category': 'restart',
        'value_type': 'string',
        'requires_restart': True,
        'env_name': 'AWS_S3_CUSTOM_DOMAIN',
        'current': lambda: getattr(settings, 'AWS_S3_CUSTOM_DOMAIN', '') or '',
    },
    'SECRET_KEY': {
        'section': 'secret_key',
        'category': 'restart',
        'value_type': 'secret_regenerate',
        'requires_restart': True,
        'env_name': 'SECRET_KEY',
        'current': lambda: _mask(settings.SECRET_KEY),
    },

    # ─── Read-only / informational ───────────────────────────────────────────
    'RAILWAY_ENVIRONMENT': {
        'section': 'platform',
        'category': 'readonly',
        'value_type': 'string',
        'requires_restart': False,
        'env_name': 'RAILWAY_ENVIRONMENT',
        'current': lambda: os.environ.get('RAILWAY_ENVIRONMENT', '') or '(not set -- running locally)',
    },
    'DATABASE_URL': {
        'section': 'database',
        'category': 'readonly',
        'value_type': 'string',
        'requires_restart': False,
        'env_name': 'DATABASE_URL',
        'current': _database_info,
    },
    'NEXT_PUBLIC_API_URL': {
        'section': 'frontend',
        'category': 'readonly',
        'value_type': 'string',
        'requires_restart': False,
        'env_name': 'NEXT_PUBLIC_API_URL',
        'current': lambda: os.environ.get('NEXT_PUBLIC_API_URL', '') or '(default: /api, same-origin)',
    },
    'NEXT_PUBLIC_SITE_NAME': {
        'section': 'frontend',
        'category': 'readonly',
        'value_type': 'string',
        'requires_restart': False,
        'env_name': 'NEXT_PUBLIC_SITE_NAME',
        'current': lambda: os.environ.get('NEXT_PUBLIC_SITE_NAME', '') or '(default)',
    },
    'NEXT_PUBLIC_MEDIA_URL': {
        'section': 'frontend',
        'category': 'readonly',
        'value_type': 'string',
        'requires_restart': False,
        'env_name': 'NEXT_PUBLIC_MEDIA_URL',
        'current': lambda: os.environ.get('NEXT_PUBLIC_MEDIA_URL', '') or '(default: /media)',
    },
}


def get_source(key):
    """Where the *current* value of `key` is coming from."""
    meta = ENV_VAR_REGISTRY[key]
    if meta['category'] == 'live':
        from core.models import EnvVarOverride
        if EnvVarOverride.objects.filter(key=key, is_enabled=True).exists():
            return 'override'
        return 'auto-detected'
    if meta['category'] == 'restart':
        from core.models import EnvVarOverride
        if EnvVarOverride.objects.filter(key=key, is_enabled=True).exists():
            return 'override'
        if meta['env_name'] and os.environ.get(meta['env_name']):
            return 'env'
        return 'default'
    # readonly
    if meta['env_name'] and os.environ.get(meta['env_name']):
        return 'env'
    return 'auto-detected'
