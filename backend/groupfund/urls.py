from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/members/', include('accounts.member_urls')),
    path('api/groups/', include('accounts.group_urls')),
    path('api/fund/', include('fund.urls')),
    path('api/posts/', include('posts.urls')),
    path('api/logs/', include('logs.urls')),
    path('api/settings/', include('core.settings_urls')),
    path('api/dashboard/', include('core.dashboard_urls')),
    path('api/payments/', include('payments.urls')),
]
