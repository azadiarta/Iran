from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

urlpatterns = [
    # Required for {% url 'set_language' %}, used by the admin theme's
    # language switcher (USE_I18N=True, LANGUAGES has 2 entries).
    path('i18n/', include('django.conf.urls.i18n')),
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/members/', include('accounts.member_urls')),
    path('api/members/', include('pwvault.urls')),
    path('api/groups/', include('accounts.group_urls')),
    path('api/fund/', include('fund.urls')),
    path('api/posts/', include('posts.urls')),
    path('api/logs/', include('logs.urls')),
    path('api/settings/', include('core.settings_urls')),
    path('api/dashboard/', include('core.dashboard_urls')),
    path('api/permissions/', include('core.urls')),
    path('api/payments/', include('payments.urls')),
    path('api/contact/', include('core.contact_urls')),
    path('api/lockdown/', include('core.lockdown_urls')),
]

if settings.DEBUG and not settings.AWS_STORAGE_BUCKET_NAME:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
elif not settings.DEBUG and not settings.AWS_STORAGE_BUCKET_NAME:
    # No S3 bucket configured — fall back to serving locally-stored media
    # directly so uploaded post images/receipts remain viewable. Note this
    # storage is EPHEMERAL on platforms like Railway (wiped on every
    # redeploy/restart); set AWS_STORAGE_BUCKET_NAME for persistent,
    # CDN-backed media storage in real production use (see .env.example).
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]
