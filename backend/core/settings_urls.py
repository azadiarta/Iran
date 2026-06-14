from django.urls import path

from core.settings_views import (
    DefaultSettingListView,
    DefaultSettingUpdateView,
    SystemStatusView,
)

urlpatterns = [
    path('',                DefaultSettingListView.as_view(),   name='settings-list'),
    path('system-status/',  SystemStatusView.as_view(),         name='system-status'),
    path('<str:key>/',      DefaultSettingUpdateView.as_view(), name='settings-update'),
]
