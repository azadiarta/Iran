import logging

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from core.captcha import verify_captcha
from core.log_utils import actor_display_for, target_display_for
from core.models import DefaultSetting
from core.utils import api_error, api_success
from fund.models import Contribution
from logs.models import ActivityLog
from payments.factory import PaymentFactory
from payments.serializers import PaymentInitiateSerializer, ReceiptUploadSerializer

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


class PaymentMethodsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            methods = PaymentFactory.all_methods()
        except Exception:
            logger.exception('Failed to build the list of available payment methods')
            methods = []
        return api_success({'methods': methods})


class PaymentInitiateView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'contribution'

    @transaction.atomic
    def post(self, request):
        if not verify_captcha(request.data.get('captcha_token'), _get_ip(request)):
            return api_error('Captcha verification failed.', status_code=400)

        serializer = PaymentInitiateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)

        data = serializer.validated_data
        payment_method = data['payment_method']

        provider = PaymentFactory.get_provider(payment_method)
        if provider is None or not provider.is_configured():
            msg = provider.get_unavailable_message() if provider else f'{payment_method} is not currently available.'
            return api_success({
                'is_available': False,
                'unavailable_message': msg,
                'contribution_id': None,
                'payment_method': payment_method,
            })

        setting = DefaultSetting.objects.filter(key='default_currency').first()
        currency = setting.value if setting else 'GBP'

        actor = request.user if request.user.is_authenticated else None
        contribution = Contribution.objects.create(
            contributor=actor,
            guest_name=data.get('guest_name', ''),
            amount=data['amount'],
            currency=currency,
            payment_method=payment_method,
            notes=data.get('notes', ''),
            status=Contribution.Status.PENDING,
            show_in_public_list=data.get('show_in_public_list', False),
            display_name_choice=data.get('display_name_choice', Contribution.DisplayNameChoice.DISPLAY_NAME),
            public_display_name=data.get('public_display_name', ''),
            message=data.get('message', ''),
        )

        instructions = provider.initiate_payment(contribution)
        _log(actor, 'payment_initiated', target=contribution, ip=_get_ip(request))

        return api_success({
            'is_available': True,
            'contribution_id': str(contribution.id),
            'payment_method': payment_method,
            'status': contribution.status,
            'instructions': instructions,
            'unavailable_message': None,
        }, status_code=201)


class ReceiptUploadView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    @transaction.atomic
    def post(self, request, pk):
        try:
            contribution = Contribution.objects.get(pk=pk)
        except Contribution.DoesNotExist:
            return api_error('Contribution not found.', status_code=404)

        if contribution.status != Contribution.Status.PENDING:
            return api_error('Receipt can only be uploaded for pending contributions.')

        serializer = ReceiptUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)

        contribution.receipt_image = serializer.validated_data['receipt_image']
        contribution.status = Contribution.Status.PENDING_REVIEW
        contribution.save(update_fields=['receipt_image', 'status'])

        actor = request.user if request.user.is_authenticated else None
        _log(actor, 'receipt_uploaded', target=contribution, ip=_get_ip(request))

        return api_success({
            'contribution_id': str(contribution.id),
            'status': contribution.status,
        }, message='Receipt uploaded. Awaiting review.')


class PaymentStatusView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            contribution = Contribution.objects.get(pk=pk)
        except Contribution.DoesNotExist:
            return api_error('Contribution not found.', status_code=404)

        return api_success({
            'contribution_id': str(contribution.id),
            'status': contribution.status,
            'payment_method': contribution.payment_method,
            'amount': str(contribution.amount),
            'currency': contribution.currency,
        })
