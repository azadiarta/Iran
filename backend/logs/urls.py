from django.urls import path

from logs.views import (
    ActivityLogDetailView,
    ActivityLogListView,
    SystemLogDetailView,
    SystemLogListView,
)

urlpatterns = [
    path('activity/',             ActivityLogListView.as_view(),   name='activity-log-list'),
    path('activity/<uuid:pk>/',   ActivityLogDetailView.as_view(), name='activity-log-detail'),
    path('system/',               SystemLogListView.as_view(),     name='system-log-list'),
    path('system/<uuid:pk>/',     SystemLogDetailView.as_view(),   name='system-log-detail'),
]
