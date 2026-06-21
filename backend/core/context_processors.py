from django.conf import settings


def turnstile(request):
    """Exposes the Turnstile site key to every Django-rendered template
    (currently only the admin login page) without each view needing to pass
    it through extra_context by hand.
    """
    return {'turnstile_site_key': settings.TURNSTILE_SITE_KEY}
