from django.contrib.admin.forms import AdminAuthenticationForm
from django.core.exceptions import ValidationError

from core.captcha import verify_captcha


def _get_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    return forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')


class CaptchaAdminAuthenticationForm(AdminAuthenticationForm):
    """Adds the same Cloudflare Turnstile CAPTCHA check used on every other
    public entry point (login/register/contact/comment/contribution) to
    Django's own /admin/ login form. This session-authenticated panel is a
    distinct attack surface from the JWT API (see groupfund/urls.py) and,
    before this, was the only login form on the site with no CAPTCHA and no
    rate limiting at all. Checked before the username/password lookup,
    mirroring the order used everywhere else (accounts/views.py LoginView).
    """

    def clean(self):
        token = self.data.get('cf-turnstile-response')
        ip = _get_ip(self.request) if self.request else None
        if not verify_captcha(token, ip):
            raise ValidationError(
                'Captcha verification failed. Please try again.',
                code='captcha_invalid',
            )
        return super().clean()
