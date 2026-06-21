from django.http import JsonResponse
from rest_framework.exceptions import AuthenticationFailed

from core.lockdown import get_lockdown_state, is_admin_member

# Paths that must stay reachable no matter what, so a blocked visitor can
# still authenticate (api/auth/) and so every client — including anonymous
# ones — can keep polling for the current lockdown kind/message and so a
# superuser/admin can still toggle it off (api/lockdown/).
_EXEMPT_PREFIXES = ('/api/auth/', '/api/lockdown/')


class SiteLockdownMiddleware:
    """
    Enforces both lockdown kinds (see core/lockdown.py) at the API layer —
    the frontend's visual gate is UX only; this is the real enforcement.

    Django's /admin/ site is untouched (this only looks at /api/ paths): it's
    already superuser-only via is_staff, which only create_superuser() ever
    sets, so a 'permission'-kind admin could never reach it anyway.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        if not path.startswith('/api/') or path.startswith(_EXEMPT_PREFIXES):
            return self.get_response(request)

        kind, message = get_lockdown_state()
        if kind is None:
            return self.get_response(request)

        user = self._resolve_user(request)
        if kind == 'superuser':
            allowed = bool(user and user.is_authenticated and user.is_superuser)
        else:
            allowed = is_admin_member(user)

        if allowed:
            return self.get_response(request)

        return JsonResponse(
            {'success': False, 'message': message, 'errors': None, 'lockdown': kind},
            status=503,
        )

    @staticmethod
    def _resolve_user(request):
        # rest_framework_simplejwt only resolves request.user at DRF's view
        # dispatch layer, not via AuthenticationMiddleware (session-only) — so
        # a JWT-bearer request reaching this far still has request.user
        # unset/anonymous. Resolve it manually for the JWT case.
        user = getattr(request, 'user', None)
        if user and user.is_authenticated:
            return user
        try:
            from rest_framework_simplejwt.authentication import JWTAuthentication
            result = JWTAuthentication().authenticate(request)
        except AuthenticationFailed:
            return None
        return result[0] if result else None
