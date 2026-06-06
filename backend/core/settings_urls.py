from django.urls import path

from core.settings_views import DefaultSettingListView, DefaultSettingUpdateView

urlpatterns = [
    path('',          DefaultSettingListView.as_view(),   name='settings-list'),
    path('<str:key>/', DefaultSettingUpdateView.as_view(), name='settings-update'),
]
