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
            SystemLog.objects.create(
                level=LEVEL_MAP.get(record.levelno, 'info'),
                source=record.name,
                message=self.format(record),
            )
        except Exception:
            pass
