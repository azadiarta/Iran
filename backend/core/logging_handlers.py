import logging

LEVEL_MAP = {
    logging.DEBUG: 'debug',
    logging.INFO: 'info',
    logging.WARNING: 'warning',
    logging.ERROR: 'error',
    logging.CRITICAL: 'critical',
}


class Quiet4xxFilter(logging.Filter):
    """Django's 'django.request' logger reports every 4xx response (401/403/404/...)
    at WARNING via log_response(), e.g. anonymous visitors hitting member-only
    endpoints (the homepage's balance/posts widgets) or bots probing the API.
    That floods both the console and the admin System Log with routine,
    expected traffic. Demote anything below 500 to INFO.

    503 is also demoted: it's never a real server error in this codebase —
    core.middleware.SiteLockdownMiddleware is the only thing that ever
    returns it, deliberately, for visitors blocked by an active site
    lockdown. Every other 5xx status keeps its original (error) level.
    """

    def filter(self, record):
        status_code = getattr(record, 'status_code', None)
        if status_code is not None and record.levelno > logging.INFO and (status_code < 500 or status_code == 503):
            record.levelno = logging.INFO
            record.levelname = 'INFO'
        return True


class SystemLogHandler(logging.Handler):
    """Persists warning-and-above log records to logs.SystemLog for the admin System Status page."""

    def emit(self, record):
        try:
            from logs.models import SystemLog

            related_member = None
            ip_address = None
            request = getattr(record, 'request', None)
            if request is not None:
                user = getattr(request, 'user', None)
                if user is not None and getattr(user, 'is_authenticated', False):
                    related_member = user
                xff = request.META.get('HTTP_X_FORWARDED_FOR')
                ip_address = xff.split(',')[0].strip() if xff else request.META.get('REMOTE_ADDR')

            SystemLog.objects.create(
                level=LEVEL_MAP.get(record.levelno, 'info'),
                source=record.name,
                message=self.format(record),
                related_member=related_member,
                ip_address=ip_address,
            )
        except Exception:
            pass
