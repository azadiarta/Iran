from django.urls import path

from pwvault.views import MemberVaultPasswordView

urlpatterns = [
    path('<uuid:pk>/vault-password/', MemberVaultPasswordView.as_view(), name='member-vault-password'),
]
