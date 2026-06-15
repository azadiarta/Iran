import logging

LEVEL_MAP = {
    logging.DEBUG: 'debug',
    logging.INFO: 'info',
    logging.WARNING: 'warning',
    logging.ERROR: 'error',
    logging.CRITICAL: 'critical',
}


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
