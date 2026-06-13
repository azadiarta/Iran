from django.contrib.auth.backends import BaseBackend
from accounts.models import Member


class MemberAuthBackend(BaseBackend):
    """
    Authenticates with phone OR email + password.
    '@' in credential → email lookup, otherwise → phone lookup.
    Superuser bypasses all permission checks.
    """

    def authenticate(self, request, credential=None, password=None, username=None, **kwargs):
        # Django's built-in AuthenticationForm (used by the admin login page)
        # calls authenticate(username=..., password=...); the app's own
        # /api/auth/login/ calls authenticate(credential=..., password=...).
        # Accept either so both flows work with this single backend.
        credential = credential or username
        if not credential or not password:
            return None

        lookup = {'email': credential} if '@' in credential else {'phone': credential}

        try:
            member = Member.objects.get(**lookup, is_active=True)
        except Member.DoesNotExist:
            return None

        if member.check_password(password):
            return member
        return None

    def get_user(self, user_id):
        try:
            return Member.objects.get(pk=user_id)
        except Member.DoesNotExist:
            return None
