from rest_framework import serializers

from core.models import DefaultSetting
from core.serializers import RelativeImageField
from core.validators import (
    LONG_TEXT_ADMIN_MAX_LENGTH,
    LONG_TEXT_PUBLIC_MAX_LENGTH,
    sanitize_and_limit,
    validate_image_file,
)
from fund.models import Contribution, Expense


class MemberMinimalSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    full_name = serializers.CharField(read_only=True)


# Admin-only variant — includes member_number, which must never be exposed
# outside the admin panel. Only used by ContributionAdminDetailSerializer
# (gated by can_manage_permissions), never by the general ContributionSerializer.
class MemberAdminMinimalSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    full_name = serializers.CharField(read_only=True)
    member_number = serializers.IntegerField(read_only=True)


class ContributionSerializer(serializers.ModelSerializer):
    contributor = MemberMinimalSerializer(read_only=True)

    class Meta:
        model = Contribution
        fields = [
            'id', 'tracking_code', 'contributor', 'guest_name', 'amount', 'currency',
            'payment_method', 'status', 'notes', 'created_at',
        ]
        read_only_fields = ['id', 'tracking_code', 'created_at']


class ContributionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contribution
        fields = [
            'guest_name', 'amount', 'currency',
            'payment_method', 'notes',
            'show_in_public_list', 'display_name_choice', 'public_display_name', 'message',
        ]
        extra_kwargs = {
            'show_in_public_list': {'required': False},
            'display_name_choice': {'required': False},
            'public_display_name': {'required': False},
            'message': {'required': False},
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        setting = DefaultSetting.objects.filter(key='default_currency').first()
        self.fields['currency'].default = setting.value if setting else 'GBP'
        self.fields['currency'].required = False

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be a positive number.')
        return value

    def validate_guest_name(self, value):
        return sanitize_and_limit(value, 50)

    def validate_notes(self, value):
        return sanitize_and_limit(value, LONG_TEXT_PUBLIC_MAX_LENGTH) if value else value

    def validate_message(self, value):
        return sanitize_and_limit(value, 150)

    def validate_public_display_name(self, value):
        return sanitize_and_limit(value, 100)

    def validate(self, data):
        request = self.context.get('request')
        is_authenticated = request and request.user and request.user.is_authenticated
        if not is_authenticated and not data.get('guest_name'):
            raise serializers.ValidationError({'guest_name': 'Guest name is required for unauthenticated contributions.'})
        return data

    def create(self, validated_data):
        request = self.context['request']
        if request.user and request.user.is_authenticated:
            validated_data['contributor'] = request.user
        validated_data.setdefault('currency', 'GBP')
        validated_data['status'] = Contribution.Status.PENDING
        return super().create(validated_data)


class ContributionManualCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contribution
        fields = ['guest_name', 'amount', 'currency', 'payment_method', 'status', 'notes']
        extra_kwargs = {
            'payment_method': {'required': False},
            'status': {'required': False},
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        setting = DefaultSetting.objects.filter(key='default_currency').first()
        self.fields['currency'].default = setting.value if setting else 'GBP'
        self.fields['currency'].required = False

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be a positive number.')
        return value

    def validate_guest_name(self, value):
        value = sanitize_and_limit(value, 50)
        if not value:
            raise serializers.ValidationError('Contributor name is required.')
        return value

    def validate_notes(self, value):
        return sanitize_and_limit(value, LONG_TEXT_ADMIN_MAX_LENGTH) if value else value

    def create(self, validated_data):
        validated_data.setdefault('currency', 'GBP')
        validated_data.setdefault('payment_method', Contribution.PaymentMethod.MANUAL)
        validated_data.setdefault('status', Contribution.Status.COMPLETED)
        return super().create(validated_data)


class ContributionStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contribution
        fields = ['status']

    def validate_status(self, value):
        allowed = [Contribution.Status.COMPLETED, Contribution.Status.FAILED]
        if value not in allowed:
            raise serializers.ValidationError('Status must be completed or failed.')
        return value


class ContributionPublicListSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = Contribution
        fields = ['id', 'display_name', 'amount', 'currency', 'message', 'created_at']

    def get_display_name(self, obj):
        choice = obj.display_name_choice
        if choice == Contribution.DisplayNameChoice.CUSTOM:
            return obj.public_display_name or None
        if choice == Contribution.DisplayNameChoice.FULL_NAME:
            return obj.contributor.full_name if obj.contributor else (obj.guest_name or None)
        if choice == Contribution.DisplayNameChoice.HIDDEN:
            return None
        if obj.contributor:
            return obj.contributor.display_name or obj.contributor.full_name
        return obj.guest_name or None


class ContributionAdminDetailSerializer(serializers.ModelSerializer):
    contributor = MemberAdminMinimalSerializer(read_only=True)
    receipt_image = RelativeImageField()

    class Meta:
        model = Contribution
        fields = [
            'id', 'tracking_code', 'contributor', 'guest_name', 'amount', 'currency',
            'payment_method', 'status', 'notes', 'receipt_image',
            'show_in_public_list', 'display_name_choice', 'public_display_name',
            'message', 'rejection_reason', 'created_at', 'updated_at',
        ]


class ContributionAdminEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contribution
        fields = [
            'amount', 'currency', 'guest_name', 'payment_method', 'status', 'notes',
            'rejection_reason', 'show_in_public_list', 'display_name_choice',
            'public_display_name', 'message',
        ]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be a positive number.')
        return value

    def validate_guest_name(self, value):
        return sanitize_and_limit(value, 50)

    def validate_notes(self, value):
        return sanitize_and_limit(value, LONG_TEXT_ADMIN_MAX_LENGTH) if value else value

    def validate_rejection_reason(self, value):
        return sanitize_and_limit(value, LONG_TEXT_ADMIN_MAX_LENGTH) if value else value

    def validate_message(self, value):
        return sanitize_and_limit(value, 150)

    def validate_public_display_name(self, value):
        return sanitize_and_limit(value, 100)


class MyContributionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contribution
        fields = [
            'id', 'tracking_code', 'amount', 'currency', 'payment_method', 'status',
            'rejection_reason', 'message', 'created_at',
        ]


class ExpenseSerializer(serializers.ModelSerializer):
    withdrawn_by = MemberMinimalSerializer(read_only=True)
    receipt_image = RelativeImageField()

    class Meta:
        model = Expense
        fields = [
            'id', 'withdrawn_by', 'amount', 'short_reason',
            'description', 'receipt_image', 'expense_date', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class ExpenseCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = ['amount', 'short_reason', 'description', 'receipt_image', 'expense_date']

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be a positive number.')
        return value

    def validate_short_reason(self, value):
        return sanitize_and_limit(value, 100)

    def validate_description(self, value):
        return sanitize_and_limit(value, LONG_TEXT_ADMIN_MAX_LENGTH) if value else value

    def validate_receipt_image(self, value):
        if not value:
            return value
        setting = DefaultSetting.objects.filter(key='max_receipt_image_size_mb').first()
        max_mb = float(setting.value) if setting else 5.0
        return validate_image_file(value, max_mb)

    def create(self, validated_data):
        validated_data['withdrawn_by'] = self.context['request'].user
        return super().create(validated_data)


class FundBalanceSerializer(serializers.Serializer):
    total_contributions = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_expenses = serializers.DecimalField(max_digits=12, decimal_places=2)
    balance = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField()
