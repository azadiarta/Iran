from rest_framework.throttling import ScopedRateThrottle


class SessionAwareScopedRateThrottle(ScopedRateThrottle):
    """Drop-in replacement for DRF's ScopedRateThrottle.

    Plain per-IP throttling (the default identity ScopedRateThrottle falls
    back to for anonymous requests) is trivially bypassed by rotating IPs
    (VPNs, proxy chains, mobile carrier NAT pools) — a real concern for a
    site organizing political activity, which is a realistic abuse/attack
    target. For unauthenticated requests, this also folds the Django session
    key into the cache identity, so an attacker has to drop/rotate BOTH their
    IP and their session cookie to reset the counter, not just one.
    Authenticated requests are unaffected (still keyed by user id, exactly
    like the base class), since session-keying a logged-in member would add
    nothing — they're already uniquely identified.
    """

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            return super().get_cache_key(request, view)

        if not request.session.session_key:
            request.session.save()

        ident = f'{self.get_ident(request)}:{request.session.session_key}'
        return self.cache_format % {'scope': self.scope, 'ident': ident}
