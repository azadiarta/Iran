from django.urls import path

from accounts.member_views import (
    ChangePasswordView,
    MemberChangeGroupView,
    MemberCreateView,
    MemberDeleteView,
    MemberDetailView,
    MemberFullProfileView,
    MemberListView,
    MemberToggleActiveView,
    MemberUpdateView,
)

urlpatterns = [
    path('',                              MemberListView.as_view(),         name='member-list'),
    path('create/',                       MemberCreateView.as_view(),       name='member-create'),
    path('<uuid:pk>/',                    MemberDetailView.as_view(),       name='member-detail'),
    path('<uuid:pk>/update/',             MemberUpdateView.as_view(),       name='member-update'),
    path('<uuid:pk>/group/',              MemberChangeGroupView.as_view(),  name='member-change-group'),
    path('<uuid:pk>/toggle-active/',      MemberToggleActiveView.as_view(), name='member-toggle-active'),
    path('<uuid:pk>/delete/',             MemberDeleteView.as_view(),       name='member-delete'),
    path('<uuid:pk>/change-password/',    ChangePasswordView.as_view(),     name='member-change-password'),
    path('<uuid:pk>/full-profile/',       MemberFullProfileView.as_view(),  name='member-full-profile'),
]
