from rest_framework import serializers

from core.models import DefaultSetting
from fund.models import Contribution


class PaymentInitiateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    payment_method = serializers.ChoiceField(choices=Contribution.PaymentMethod.choices)
    guest_name = serializers.CharField(max_length=50, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be a positive number.')
        return value

    def validate(self, data):
        request = self.context.get('request')
        is_authenticated = request and request.user and request.user.is_authenticated
        if not is_authenticated and not data.get('guest_name'):
            raise serializers.ValidationError({'guest_name': 'Guest name is required for unauthenticated payments.'})
        return data


class ReceiptUploadSerializer(serializers.Serializer):
    receipt_image = serializers.FileField()

    def validate_receipt_image(self, value):
        ext = value.name.rsplit('.', 1)[-1].lower() if '.' in value.name else ''
        if ext not in ('jpg', 'jpeg', 'png', 'pdf'):
            raise serializers.ValidationError('Receipt must be a JPG, PNG, or PDF file.')
        setting = DefaultSetting.objects.filter(key='max_receipt_image_size_mb').first()
        max_mb = float(setting.value) if setting else 5.0
        if value.size > max_mb * 1024 * 1024:
            raise serializers.ValidationError(f'Receipt must be under {max_mb:.0f}MB.')
        return value
