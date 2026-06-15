from django.urls import path

from core.env_vars_views import (
    EnvVarListView,
    EnvVarResetAllView,
    EnvVarResetView,
    EnvVarUpdateView,
)

urlpatterns = [
    path('',                EnvVarListView.as_view(),     name='env-vars-list'),
    path('reset-all/',      EnvVarResetAllView.as_view(), name='env-vars-reset-all'),
    path('<str:key>/',      EnvVarUpdateView.as_view(),   name='env-vars-update'),
    path('<str:key>/reset/', EnvVarResetView.as_view(),   name='env-vars-reset'),
]
