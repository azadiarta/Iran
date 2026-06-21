from django.urls import path

from core.lockdown_views import (
    LockdownStatusView,
    PermissionLockdownToggleView,
    SuperuserLockdownToggleView,
)

urlpatterns = [
    path('',             LockdownStatusView.as_view(),            name='lockdown-status'),
    path('superuser/',   SuperuserLockdownToggleView.as_view(),   name='lockdown-superuser'),
    path('permission/',  PermissionLockdownToggleView.as_view(),  name='lockdown-permission'),
]
