import logging

from django.contrib.contenttypes.models import ContentType
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from accounts.models import Member
from accounts.permissions import IsSuperuser
from core.log_utils import actor_display_for, target_display_for
from core.utils import api_error, api_success
from logs.models import ActivityLog
from pwvault.crypto import decrypt_password_entry, verify_chain
from pwvault.models import PasswordVaultHistory
from pwvault.transport import (
    InvalidClientKey,
    encrypt_for_transport_e2e,
    encrypt_many_for_transport_e2e,
    parse_client_kem_public_key,
    parse_client_public_key,
)

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


def _get_member_or_404(pk):
    try:
        return Member.objects.get(pk=pk), None
    except Member.DoesNotExist:
        return None, api_error('Member not found.', status_code=404)


def _client_public_key_or_error(request):
    """The browser's one-time ECDH public key for this single reveal (see
    pwvault/transport.py) -- required for every endpoint in this module,
    since there is no key to encrypt the response with otherwise."""
    epk_b64 = request.query_params.get('epk')
    if not epk_b64:
        return None, api_error('Missing required "epk" query parameter.', status_code=400)
    try:
        return parse_client_public_key(epk_b64), None
    except InvalidClientKey:
        return None, api_error('Invalid "epk" query parameter.', status_code=400)


def _client_kem_public_key_or_error(request):
    """The browser's one-time ML-KEM-768 public key for this single reveal
    (see pwvault/transport.py's post-quantum outer layer) -- required
    alongside `epk`, since the outermost transport layer is keyed from this
    exchange, not the ECDH one."""
    kem_pk_b64 = request.query_params.get('kem_pk')
    if not kem_pk_b64:
        return None, api_error('Missing required "kem_pk" query parameter.', status_code=400)
    try:
        return parse_client_kem_public_key(kem_pk_b64), None
    except InvalidClientKey:
        return None, api_error('Invalid "kem_pk" query parameter.', status_code=400)


def _token_bytes_from_request(request) -> bytes:
    """Raw JWT access token that authenticated this very request -- the
    shared secret behind pwvault/transport.py's inner token-bound encryption
    layer. Never logged, never echoed back to the client."""
    auth_header = request.headers.get('Authorization', '')
    token_str = auth_header[7:] if auth_header.startswith('Bearer ') else auth_header
    return token_str.encode('utf-8')


class MemberVaultPasswordView(APIView):
    # Superuser-only — deliberately NOT extended with HasGroupPermission like
    # every other admin endpoint in this codebase (see accounts/permissions.py).
    permission_classes = [IsAuthenticated, IsSuperuser]

    def get(self, request, pk):
        member, error = _get_member_or_404(pk)
        if error:
            return error
        client_public_key, error = _client_public_key_or_error(request)
        if error:
            return error
        client_kem_public_key, error = _client_kem_public_key_or_error(request)
        if error:
            return error

        latest = PasswordVaultHistory.objects.filter(member=member).order_by('-sequence').first()
        plaintext = None
        if latest is not None:
            try:
                plaintext = decrypt_password_entry(latest)
            except Exception:
                # Decrypt can legitimately fail (e.g. PWVAULT_SECRET_KEY rotated
                # since this entry was written) — fail closed to "no password
                # recorded" rather than a 500.
                logger.exception('pwvault: failed to decrypt latest vault entry for member %s', pk)
                plaintext = None

        _log(request.user, 'password_vault_viewed', target=member, ip=_get_ip(request))

        if plaintext is None:
            return api_success(data={'has_password': False, 'envelope': None})

        envelope = encrypt_for_transport_e2e(
            plaintext, client_public_key, client_kem_public_key, member.id, _token_bytes_from_request(request)
        )
        return api_success(data={'has_password': True, 'envelope': envelope})


class MemberVaultPasswordHistoryView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser]

    def get(self, request, pk):
        member, error = _get_member_or_404(pk)
        if error:
            return error
        client_public_key, error = _client_public_key_or_error(request)
        if error:
            return error
        client_kem_public_key, error = _client_kem_public_key_or_error(request)
        if error:
            return error

        # Ascending order is required here — verify_chain() walks each row
        # against the one immediately before it.
        history = list(PasswordVaultHistory.objects.filter(member=member).order_by('sequence'))
        chain_intact = verify_chain(history) if history else True

        decryptable = []
        for row in history:
            try:
                decryptable.append((row, decrypt_password_entry(row)))
            except Exception:
                # Same fail-closed posture as the single-password view: a row
                # that can't be decrypted (e.g. predates a key rotation) is
                # simply omitted rather than surfaced as an error.
                logger.exception('pwvault: failed to decrypt vault history row %s for member %s', row.pk, pk)

        _log(request.user, 'password_vault_history_viewed', target=member, ip=_get_ip(request))

        if not decryptable:
            return api_success(data={
                'server_epk': None, 'salt': None, 'pq_ciphertext': None, 'pq_salt': None,
                'entries': [], 'chain_intact': chain_intact,
            })

        bulk = encrypt_many_for_transport_e2e(
            [(row.sequence, plaintext) for row, plaintext in decryptable], client_public_key,
            client_kem_public_key, member.id, _token_bytes_from_request(request),
        )
        entries = [
            {'sequence': row.sequence, 'created_at': row.created_at.isoformat(), **envelope}
            for (row, _plaintext), envelope in zip(decryptable, bulk['envelopes'])
        ]
        entries.reverse()  # newest first, for display

        return api_success(data={
            'server_epk': bulk['server_epk'],
            'salt': bulk['salt'],
            'pq_ciphertext': bulk['pq_ciphertext'],
            'pq_salt': bulk['pq_salt'],
            'entries': entries,
            'chain_intact': chain_intact,
        })
