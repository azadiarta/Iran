from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import LoginView, LogoutView, ProfileView, RegisterView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('profile/', ProfileView.as_view(), name='auth-profile'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
]
