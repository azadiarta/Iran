import logging
import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

# Railway always injects RAILWAY_ENVIRONMENT for every deployment — use its
# presence as a reliable "are we running on Railway" signal so the handful of
# settings below can auto-configure themselves with zero user input.
_on_railway = bool(os.environ.get('RAILWAY_ENVIRONMENT'))

SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    if _on_railway:
        # Derive a stable per-service secret from Railway's auto-injected
        # project/service IDs (stable UUIDs, never exposed to the frontend) so
        # a working deployment needs zero typed/generated secrets.
        import hashlib
        _seed = os.environ.get('RAILWAY_PROJECT_ID', '') + os.environ.get('RAILWAY_SERVICE_ID', '')
        SECRET_KEY = hashlib.sha256(_seed.encode()).hexdigest()
    else:
        SECRET_KEY = 'insecure-dev-key-replace-in-production'

# Default to secure (DEBUG=False) when we know we're deployed on Railway, and to
# the convenient dev default (DEBUG=True) everywhere else; either can still be
# overridden explicitly via the DEBUG env var.
DEBUG = os.environ.get('DEBUG', 'False' if _on_railway else 'True') == 'True'
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# Railway injects RAILWAY_PUBLIC_DOMAIN with the service's *.up.railway.app (or
# custom) domain when a public domain is generated for it — append it
# automatically so ALLOWED_HOSTS/CSRF need no manual wiring if you do generate
# one for this service. Has no effect for docker-compose (var is unset there).
_railway_public_domain = os.environ.get('RAILWAY_PUBLIC_DOMAIN')
if _railway_public_domain and _railway_public_domain not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(_railway_public_domain)

# Railway also injects RAILWAY_PRIVATE_DOMAIN (a *.railway.internal address)
# for every service, used for service-to-service traffic on the private
# network. In the recommended single-origin setup, the frontend service proxies
# /api/, /admin/, /static/ and /media/ requests here (see
# frontend/next.config.mjs rewrites() + BACKEND_INTERNAL_URL), and those
# requests arrive with this private domain as their Host header.
_railway_private_domain = os.environ.get('RAILWAY_PRIVATE_DOMAIN')
if _railway_private_domain and _railway_private_domain not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(_railway_private_domain)

# Required for the Django admin (and any cross-origin POST/PUT/PATCH/DELETE) to
# work behind a TLS-terminating reverse proxy (e.g. Caddy): with
# SECURE_PROXY_SSL_HEADER set, Django treats the request as secure and validates
# the Origin/Referer header against this list, which must include the scheme.
# Defaults to "https://" + each non-local ALLOWED_HOSTS entry; override
# explicitly via env if needed (the Docker setup always sets this explicitly).
CSRF_TRUSTED_ORIGINS = [
    origin.strip() for origin in os.environ.get('CSRF_TRUSTED_ORIGINS', '').split(',') if origin.strip()
] or [
    f'https://{host}' for host in ALLOWED_HOSTS if host not in ('localhost', '127.0.0.1', '*')
]
if _railway_public_domain:
    _railway_origin = f'https://{_railway_public_domain}'
    if _railway_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(_railway_origin)
if _on_railway:
    # The frontend service (the public entry point in the single-origin setup)
    # gets a random *.up.railway.app subdomain that this service doesn't know in
    # advance — trust the whole suffix instead of requiring it to be wired up by
    # hand. Django 4.0+ supports leading-wildcard CSRF_TRUSTED_ORIGINS entries.
    # Using a custom domain instead? Set CSRF_TRUSTED_ORIGINS explicitly.
    _railway_wildcard_origin = 'https://*.up.railway.app'
    if _railway_wildcard_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(_railway_wildcard_origin)

INSTALLED_APPS = [
    'jazzmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'storages',
    'core',
    'accounts',
    'fund',
    'posts',
    'logs',
    'payments',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'groupfund.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

AUTH_USER_MODEL = 'accounts.Member'

AUTHENTICATION_BACKENDS = [
    'accounts.backends.MemberAuthBackend',
]

# Railway's managed Postgres plugin (and many other PaaS providers) expose a
# single DATABASE_URL connection string instead of separate host/user/password
# variables. Prefer it when present so Railway deploys need zero DB wiring;
# docker-compose (which sets the discrete DB_* vars) keeps working unchanged.
_database_url = os.environ.get('DATABASE_URL')
_db_name = os.environ.get('DB_NAME')

if _database_url:
    from urllib.parse import urlparse
    _parsed_db_url = urlparse(_database_url)
    if not (_parsed_db_url.hostname and _parsed_db_url.scheme.startswith('postgres')):
        # An unresolved Railway variable reference (e.g. the literal string
        # "${{Postgres.DATABASE_URL}}" when the reference didn't bind, or a
        # typo'd/renamed Postgres service name) parses to a URL with no
        # hostname. Using it as-is would point Postgres at "localhost" and
        # crash the container on every boot, so fall back to DB_NAME/SQLite
        # instead and log a warning that shows up in the deploy logs.
        logging.getLogger(__name__).warning(
            "DATABASE_URL is set but did not resolve to a valid Postgres URL "
            "(got %r) -- falling back to DB_NAME/SQLite. Check that the "
            "variable reference (e.g. ${{Postgres.DATABASE_URL}}) matches the "
            "exact name of your Postgres service in Railway.",
            _database_url,
        )
        _database_url = None

if _database_url:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': _parsed_db_url.path.lstrip('/'),
            'USER': _parsed_db_url.username or '',
            'PASSWORD': _parsed_db_url.password or '',
            'HOST': _parsed_db_url.hostname,
            'PORT': _parsed_db_url.port or 5432,
        }
    }
elif _db_name:
    DATABASES = {
        'default': {
            'ENGINE': os.environ.get('DB_ENGINE', 'django.db.backends.postgresql'),
            'NAME': _db_name,
            'USER': os.environ.get('DB_USER', ''),
            'PASSWORD': os.environ.get('DB_PASSWORD', ''),
            'HOST': os.environ.get('DB_HOST', 'localhost'),
            'PORT': os.environ.get('DB_PORT', '5432'),
        }
    }
else:
    # Neither DATABASE_URL nor DB_NAME is set — e.g. a Railway backend service
    # with no Postgres plugin attached. Fall back to a local SQLite database so
    # the project runs with zero DB configuration (useful for quick testing
    # within Railway's service-count limits). Note: on Railway the container
    # filesystem is ephemeral, so this database is wiped on every
    # redeploy/restart — fine for testing, not for real data. To switch to
    # Postgres later, add a Postgres plugin and set DATABASE_URL to reference
    # it (see DEPLOYMENT.md); no further code changes are needed.
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Railway's filesystem is ephemeral, so uploaded media (post images, payment
# receipts) must live in an S3-compatible bucket (AWS S3, Cloudflare R2,
# Backblaze B2, ...) rather than on local disk. Set AWS_STORAGE_BUCKET_NAME
# (+ credentials) to switch media storage to the bucket; otherwise local
# MEDIA_ROOT is used (fine for local development).
AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME', '')

if AWS_STORAGE_BUCKET_NAME:
    AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID', '')
    AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY', '')
    AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', '')
    AWS_S3_ENDPOINT_URL = os.environ.get('AWS_S3_ENDPOINT_URL', '') or None
    AWS_S3_CUSTOM_DOMAIN = os.environ.get('AWS_S3_CUSTOM_DOMAIN', '') or None
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = False
    AWS_S3_FILE_OVERWRITE = False

    # Old-style setting kept (rather than STORAGES) because Django raises
    # ImproperlyConfigured if STORAGES and STATICFILES_STORAGE are both set,
    # and STATICFILES_STORAGE (whitenoise) is configured unconditionally above.
    DEFAULT_FILE_STORAGE = 'storages.backends.s3.S3Storage'

    if AWS_S3_CUSTOM_DOMAIN:
        MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/'
    elif AWS_S3_ENDPOINT_URL:
        MEDIA_URL = f'{AWS_S3_ENDPOINT_URL}/{AWS_STORAGE_BUCKET_NAME}/'
    else:
        MEDIA_URL = f'https://{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com/'
else:
    MEDIA_URL = '/media/'
    MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

CORS_ALLOWED_ORIGINS = [
    origin.strip() for origin in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',') if origin.strip()
] or (['http://localhost:3000'] if not _on_railway else [])

# On Railway the frontend and backend are two separate services on different
# *.up.railway.app subdomains, so the frontend's exact origin isn't known to the
# backend in advance. Trust the whole *.up.railway.app suffix for CORS instead
# of requiring the user to wire CORS_ALLOWED_ORIGINS by hand — safe to do here
# because the API is JWT-bearer-token authenticated (CORS_ALLOW_CREDENTIALS is
# never enabled, so no cookies/sessions ever cross origins; CSRF_TRUSTED_ORIGINS
# above stays a strict allowlist for the session-authenticated /admin/ panel).
CORS_ALLOWED_ORIGIN_REGEXES = (
    [r'^https://[a-zA-Z0-9-]+\.up\.railway\.app$'] if _on_railway else []
)

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.MultiPartParser',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
    },
    'COERCE_DECIMAL_TO_STRING': False,
}

# ─── i18n ─────────────────────────────────────────────────────────────────────
# Run: django-admin makemessages -l fa
LANGUAGE_CODE = 'en-us'
USE_I18N = True
LANGUAGES = [
    ('en', 'English'),
    ('fa', 'Persian'),
]
LOCALE_PATHS = [BASE_DIR / 'locale']

# ─── Jazzmin ──────────────────────────────────────────────────────────────────
JAZZMIN_SETTINGS = {
    'site_title': 'Group Fund Admin',
    'site_header': 'Group Fund',
    'site_brand': 'Group Fund',
    'welcome_sign': 'Welcome to Group Fund Admin Panel',
    'copyright': 'Group Fund',
    'show_themes': True,
    'theme': 'darkly',
    'dark_mode_theme': 'darkly',
    'language_chooser': True,
    'icons': {
        'auth': 'fas fa-users-cog',
        'accounts.member': 'fas fa-user',
        'accounts.accessgroup': 'fas fa-shield-alt',
        'core.permission': 'fas fa-key',
        'core.defaultsetting': 'fas fa-cog',
        'fund.contribution': 'fas fa-arrow-circle-up',
        'fund.expense': 'fas fa-arrow-circle-down',
        'posts.post': 'fas fa-newspaper',
        'posts.postimage': 'fas fa-image',
        'posts.comment': 'fas fa-comments',
        'logs.activitylog': 'fas fa-history',
        'logs.systemlog': 'fas fa-server',
    },
    'order_with_respect_to': ['core', 'accounts', 'fund', 'posts', 'logs'],
    'hide_apps': [],
    'hide_models': [],
    'topmenu_links': [
        {'name': 'Home', 'url': 'admin:index', 'permissions': ['auth.view_user']},
        {'name': 'API', 'url': '/api/', 'new_window': True},
    ],
}

JAZZMIN_UI_TWEAKS = {
    'navbar_small_text': False,
    'footer_small_text': False,
    'body_small_text': False,
    'brand_small_text': False,
    'brand_colour': 'navbar-dark',
    'accent': 'accent-teal',
    'navbar': 'navbar-dark',
    'no_navbar_border': True,
    'navbar_fixed': True,
    'layout_boxed': False,
    'footer_fixed': False,
    'sidebar_fixed': True,
    'sidebar': 'sidebar-dark-teal',
    'sidebar_nav_small_text': False,
    'sidebar_disable_expand': False,
    'sidebar_nav_child_indent': True,
    'sidebar_nav_compact_style': False,
    'sidebar_nav_legacy_style': False,
    'sidebar_nav_flat_style': False,
    'theme': 'darkly',
    'dark_mode_theme': 'darkly',
    'button_classes': {
        'primary': 'btn-primary',
        'secondary': 'btn-secondary',
        'info': 'btn-info',
        'warning': 'btn-warning',
        'danger': 'btn-danger',
        'success': 'btn-success',
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    # Deactivated members must stay authenticated (so ProfileView/LogoutView
    # keep working and they aren't bounced through the token-refresh/logout
    # cascade) -- IsActiveMember/HasGroupPermission still gate everything else.
    'CHECK_USER_IS_ACTIVE': False,
}

# ─── Production security ──────────────────────────────────────────────────────
# Railway (and most PaaS providers) terminate TLS at a reverse proxy and forward
# requests over plain HTTP, signalling the original protocol via this header.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

if not DEBUG:
    # Default to False: this backend is always reached over plain HTTP from a
    # reverse proxy on the same host/network — Caddy in docker-compose, or the
    # frontend service's rewrite-proxy on Railway (see
    # frontend/next.config.mjs) — which already terminates HTTPS for the
    # public-facing connection. Redirecting here would either be a no-op or
    # (for the Railway proxy, which talks to this private/internal service over
    # plain HTTP) cause an infinite redirect loop. Set to 'True' explicitly only
    # if this service is itself reachable directly over HTTPS.
    SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'False') == 'True'
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30  # 30 days
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    X_FRAME_OPTIONS = 'DENY'

# ─── Logging ──────────────────────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'quiet_4xx': {
            '()': 'core.logging_handlers.Quiet4xxFilter',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
        'system_log': {
            'class': 'core.logging_handlers.SystemLogHandler',
            'level': 'WARNING',
        },
    },
    'root': {
        'handlers': ['console', 'system_log'],
        'level': 'INFO' if DEBUG else 'WARNING',
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'system_log'],
            'level': 'INFO' if DEBUG else 'WARNING',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console', 'system_log'],
            'level': 'INFO' if DEBUG else 'WARNING',
            'filters': ['quiet_4xx'],
            'propagate': False,
        },
    },
}
