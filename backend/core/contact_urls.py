from django.urls import path

from core.contact_views import (
    ContactMessageCreateView,
    ContactMessageListView,
    ContactMessageToggleHandledView,
)

urlpatterns = [
    path('submit/',                    ContactMessageCreateView.as_view(),         name='contact-message-submit'),
    path('',                           ContactMessageListView.as_view(),           name='contact-message-list'),
    path('<uuid:pk>/toggle-handled/',  ContactMessageToggleHandledView.as_view(),  name='contact-message-toggle-handled'),
]
