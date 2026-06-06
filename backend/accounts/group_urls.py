from django.urls import path

from accounts.group_views import (
    AccessGroupCreateView,
    AccessGroupDeleteView,
    AccessGroupListView,
    AccessGroupSetDefaultView,
    AccessGroupUpdateView,
)

urlpatterns = [
    path('',                          AccessGroupListView.as_view(),       name='group-list'),
    path('create/',                   AccessGroupCreateView.as_view(),     name='group-create'),
    path('<uuid:pk>/update/',         AccessGroupUpdateView.as_view(),     name='group-update'),
    path('<uuid:pk>/set-default/',    AccessGroupSetDefaultView.as_view(), name='group-set-default'),
    path('<uuid:pk>/delete/',         AccessGroupDeleteView.as_view(),     name='group-delete'),
]
