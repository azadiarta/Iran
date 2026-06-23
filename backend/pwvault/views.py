import logging

from django.contrib.contenttypes.models import ContentType
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from accounts.models import Member
from accounts.permissions import IsSuperuser
from core.log_utils import actor_display_for, target_display_for
from core.utils import api_error, api_success
from logs.models import ActivityLog
from pwvault.crypto import decrypt_password
from pwvault.models import PasswordVaultEntry
from pwvault.transport import encrypt_for_transport

logger = logging.getLogger(__name__)


def _log(actor, action, target=None, extra_data=None, ip=None):
    target_type = None
    target_id = None
    if target:
        target_type = ContentType.objects.get_for_model(target)
        target_id = target.pk
    ActivityLog.objects.create(
        actor=actor,
        actor_display=actor_display_for(actor),
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_display=target_display_for(target),
        ip_address=ip,
        extra_data=extra_data,
    )


def _get_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    return forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')


class MemberVaultPasswordView(APIView):
    # Superuser-only — deliberately NOT extended with HasGroupPermission like
    # every other admin endpoint in this codebase (see accounts/permissions.py).
    permission_classes = [IsAuthenticated, IsSuperuser]

    def get(self, request, pk):
        try:
            member = Member.objects.get(pk=pk)
        except Member.DoesNotExist:
            return api_error('Member not found.', status_code=404)

        plaintext = None
        try:
            plaintext = decrypt_password(member.password_vault_entry.ciphertext)
        except PasswordVaultEntry.DoesNotExist:
            plaintext = None
        except Exception:
            # Decrypt can legitimately fail (e.g. PWVAULT_SECRET_KEY rotated
            # since this entry was written) — fail closed to "no password
            # recorded" rather than a 500.
            logger.exception('pwvault: failed to decrypt vault entry for member %s', pk)
            plaintext = None

        _log(request.user, 'password_vault_viewed', target=member, ip=_get_ip(request))

        if plaintext is None:
            return api_success(data={'has_password': False, 'envelope': None})

        auth_header = request.headers.get('Authorization', '')
        token_str = auth_header[7:] if auth_header.startswith('Bearer ') else auth_header
        envelope = encrypt_for_transport(plaintext, token_str.encode('utf-8'))
        return api_success(data={'has_password': True, 'envelope': envelope})
