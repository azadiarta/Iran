from django.urls import path

from fund.views import (
    ContributionAdminDetailView,
    ContributionAdminEditView,
    ContributionCreateView,
    ContributionDeleteView,
    ContributionListView,
    ContributionManualCreateView,
    ContributionPublicListView,
    ContributionStatusUpdateView,
    ExpenseCreateView,
    ExpenseDeleteView,
    ExpenseDetailView,
    ExpenseListView,
    FundBalanceView,
    MyContributionsView,
)
from posts.views import CommentCreateView, CommentListView

urlpatterns = [
    path('contributions/',                       ContributionListView.as_view(),         name='contribution-list'),
    path('contributions/create/',                ContributionCreateView.as_view(),        name='contribution-create'),
    path('contributions/create-manual/',         ContributionManualCreateView.as_view(),  name='contribution-create-manual'),
    path('contributions/public/',                ContributionPublicListView.as_view(),    name='contribution-public-list'),
    path('contributions/mine/',                  MyContributionsView.as_view(),           name='contribution-mine'),
    path('contributions/<uuid:pk>/status/',      ContributionStatusUpdateView.as_view(),  name='contribution-status'),
    path('contributions/<uuid:pk>/delete/',      ContributionDeleteView.as_view(),        name='contribution-delete'),
    path('contributions/<uuid:pk>/edit/',        ContributionAdminEditView.as_view(),     name='contribution-admin-edit'),
    path('contributions/<uuid:pk>/',             ContributionAdminDetailView.as_view(),   name='contribution-admin-detail'),
    path('expenses/',                            ExpenseListView.as_view(),               name='expense-list'),
    path('expenses/create/',                     ExpenseCreateView.as_view(),             name='expense-create'),
    path('expenses/<uuid:pk>/',                  ExpenseDetailView.as_view(),             name='expense-detail'),
    path('expenses/<uuid:pk>/delete/',           ExpenseDeleteView.as_view(),             name='expense-delete'),
    path('balance/',                             FundBalanceView.as_view(),               name='fund-balance'),

    # Comments on expenses
    path('expenses/<uuid:pk>/comments/',         CommentListView.as_view(),   kwargs={'target_type': 'expense'}, name='expense-comment-list'),
    path('expenses/<uuid:pk>/comments/create/',  CommentCreateView.as_view(), kwargs={'target_type': 'expense'}, name='expense-comment-create'),
]
