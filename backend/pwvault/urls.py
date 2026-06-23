from django.urls import path

from pwvault.views import MemberVaultPasswordHistoryView, MemberVaultPasswordView

urlpatterns = [
    path('<uuid:pk>/vault-password/', MemberVaultPasswordView.as_view(), name='member-vault-password'),
    path('<uuid:pk>/vault-password/history/', MemberVaultPasswordHistoryView.as_view(), name='member-vault-password-history'),
]
