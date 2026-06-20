import json
import logging
import urllib.parse
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'


def verify_captcha(token, remote_ip=None):
    """Verify a Cloudflare Turnstile token server-side. Returns False on any
    missing/invalid token or verification-request failure (fail closed)."""
    if not token:
        return False
    payload = urllib.parse.urlencode({
        'secret': settings.TURNSTILE_SECRET_KEY,
        'response': token,
        'remoteip': remote_ip or '',
    }).encode()
    try:
        with urllib.request.urlopen(TURNSTILE_VERIFY_URL, data=payload, timeout=5) as resp:
            result = json.loads(resp.read())
        return bool(result.get('success'))
    except Exception:
        logger.exception('Turnstile captcha verification request failed')
        return False
