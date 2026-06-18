from django.urls import path

from core.contact_views import (
    ContactMessageCreateView,
    ContactMessageListView,
    ContactMessageToggleHandledView,
    MyContactMessagesView,
)

urlpatterns = [
    path('submit/',                    ContactMessageCreateView.as_view(),         name='contact-message-submit'),
    path('mine/',                      MyContactMessagesView.as_view(),            name='contact-message-mine'),
    path('',                           ContactMessageListView.as_view(),           name='contact-message-list'),
    path('<uuid:pk>/toggle-handled/',  ContactMessageToggleHandledView.as_view(),  name='contact-message-toggle-handled'),
]
