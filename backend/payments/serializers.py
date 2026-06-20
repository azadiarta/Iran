from rest_framework import serializers

from core.models import DefaultSetting
from core.validators import (
    LONG_TEXT_PUBLIC_MAX_LENGTH,
    SHORT_TEXT_PUBLIC_MAX_LENGTH,
    sanitize_and_limit,
    validate_receipt_file,
)
from fund.models import Contribution


class PaymentInitiateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=11, decimal_places=2)
    payment_method = serializers.ChoiceField(choices=Contribution.PaymentMethod.choices)
    guest_name = serializers.CharField(max_length=50, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=LONG_TEXT_PUBLIC_MAX_LENGTH)
    show_in_public_list = serializers.BooleanField(required=False, default=False)
    display_name_choice = serializers.ChoiceField(
        choices=Contribution.DisplayNameChoice.choices,
        required=False, default=Contribution.DisplayNameChoice.DISPLAY_NAME,
    )
    public_display_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    message = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be a positive number.')
        return value

    def validate_guest_name(self, value):
        return sanitize_and_limit(value, SHORT_TEXT_PUBLIC_MAX_LENGTH)

    def validate_notes(self, value):
        return sanitize_and_limit(value, LONG_TEXT_PUBLIC_MAX_LENGTH)

    def validate_message(self, value):
        return sanitize_and_limit(value, SHORT_TEXT_PUBLIC_MAX_LENGTH)

    def validate_public_display_name(self, value):
        return sanitize_and_limit(value, SHORT_TEXT_PUBLIC_MAX_LENGTH)

    def validate(self, data):
        request = self.context.get('request')
        is_authenticated = request and request.user and request.user.is_authenticated
        if not is_authenticated and not data.get('guest_name'):
            raise serializers.ValidationError({'guest_name': 'Guest name is required for unauthenticated payments.'})
        return data


class ReceiptUploadSerializer(serializers.Serializer):
    receipt_image = serializers.FileField()

    def validate_receipt_image(self, value):
        setting = DefaultSetting.objects.filter(key='max_receipt_image_size_mb').first()
        max_mb = float(setting.value) if setting else 5.0
        return validate_receipt_file(value, max_mb)
