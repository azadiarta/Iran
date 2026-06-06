from rest_framework.permissions import BasePermission


class IsActiveMember(BasePermission):
    """Passes if the authenticated member is active."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active
        )


class IsSuperuser(BasePermission):
    """
    Passes ONLY for superuser.
    Superuser bypasses ALL permission checks.
    Superuser is created ONLY via: python manage.py createsuperuser
    No API endpoint exists to create or modify superuser.
    No member — regardless of permissions — can delete or modify superuser.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_superuser
        )


def HasGroupPermission(codename):
    """
    Factory that returns a DRF permission class checking for a specific codename.
    Superuser always passes — bypasses all group permission checks.

    Usage:
        permission_classes = [IsAuthenticated, HasGroupPermission('can_post')]
    """

    class _HasGroupPermission(BasePermission):
        def has_permission(self, request, view):
            if not request.user or not request.user.is_authenticated:
                return False
            if not request.user.is_active:
                return False
            # Superuser bypasses ALL permission checks
            if request.user.is_superuser:
                return True
            if not request.user.group:
                return False
            return request.user.group.permissions.filter(codename=codename).exists()

    _HasGroupPermission.__name__ = f'HasGroupPermission_{codename}'
    return _HasGroupPermission
