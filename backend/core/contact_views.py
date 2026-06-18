from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from accounts.permissions import HasGroupPermission
from core.models import ContactMessage
from core.pagination import paginate
from core.serializers import ContactMessageCreateSerializer, ContactMessageSerializer
from core.utils import api_error, api_success
from logs.models import ActivityLog


def _log(actor, action, target=None, extra_data=None, ip=None):
    actor_display = str(actor) if (actor and actor.is_authenticated) else 'guest'
    target_type = None
    target_id = None
    target_display = ''
    if target:
        target_type = ContentType.objects.get_for_model(target)
        target_id = target.pk
        target_display = str(target)
    ActivityLog.objects.create(
        actor=actor if (actor and actor.is_authenticated) else None,
        actor_display=actor_display,
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_display=target_display,
        ip_address=ip,
        extra_data=extra_data,
    )


def _get_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    return forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')


class ContactMessageCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ContactMessageCreateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)
        message = serializer.save()
        actor = request.user if request.user.is_authenticated else None
        _log(actor, 'contact_message_submitted', target=message, ip=_get_ip(request))
        return api_success(ContactMessageSerializer(message).data, message='Message submitted.', status_code=201)


class ContactMessageListView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_contact_messages')]

    def get(self, request):
        qs = ContactMessage.objects.select_related('sender', 'handled_by').order_by('-created_at')

        is_handled = request.query_params.get('is_handled')
        if is_handled is not None:
            qs = qs.filter(is_handled=is_handled.lower() in ('true', '1'))

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(contact_info__icontains=search)
                | Q(message__icontains=search)
            )

        return paginate(qs, request, ContactMessageSerializer)


class ContactMessageToggleHandledView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_contact_messages')]

    def patch(self, request, pk):
        try:
            message = ContactMessage.objects.get(pk=pk)
        except ContactMessage.DoesNotExist:
            return api_error('Message not found.', status_code=404)

        previous_state = message.is_handled
        message.is_handled = not message.is_handled

        if message.is_handled:
            message.handled_by = request.user
            message.handled_at = timezone.now()
        else:
            message.handled_by = None
            message.handled_at = None

        message.save(update_fields=['is_handled', 'handled_by', 'handled_at'])

        _log(request.user, 'contact_message_toggled_handled', target=message, ip=_get_ip(request), extra_data={
            'previous_state': previous_state,
            'new_state': message.is_handled,
        })
        status_label = 'handled' if message.is_handled else 'unhandled'
        return api_success(ContactMessageSerializer(message).data, message=f'Message marked as {status_label}.')
