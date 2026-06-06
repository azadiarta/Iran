from django.contrib.auth.backends import BaseBackend
from accounts.models import Member


class MemberAuthBackend(BaseBackend):
    """
    Authenticates with phone OR email + password.
    '@' in credential → email lookup, otherwise → phone lookup.
    Superuser bypasses all permission checks.
    """

    def authenticate(self, request, credential=None, password=None, **kwargs):
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
