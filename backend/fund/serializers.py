from rest_framework import serializers

from core.models import DefaultSetting
from fund.models import Contribution, Expense


class MemberMinimalSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    full_name = serializers.CharField(read_only=True)


class ContributionSerializer(serializers.ModelSerializer):
    contributor = MemberMinimalSerializer(read_only=True)

    class Meta:
        model = Contribution
        fields = [
            'id', 'contributor', 'guest_name', 'amount', 'currency',
            'payment_method', 'status', 'notes', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class ContributionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contribution
        fields = [
            'guest_name', 'amount', 'currency',
            'payment_method', 'notes',
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        setting = DefaultSetting.objects.filter(key='default_currency').first()
        self.fields['currency'].default = setting.value if setting else 'GBP'
        self.fields['currency'].required = False

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be a positive number.')
        return value

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


class ContributionStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contribution
        fields = ['status']

    def validate_status(self, value):
        allowed = [Contribution.Status.COMPLETED, Contribution.Status.FAILED]
        if value not in allowed:
            raise serializers.ValidationError('Status must be completed or failed.')
        return value


class ExpenseSerializer(serializers.ModelSerializer):
    withdrawn_by = MemberMinimalSerializer(read_only=True)

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

    def validate_receipt_image(self, value):
        if not value:
            return value
        setting = DefaultSetting.objects.filter(key='max_receipt_image_size_mb').first()
        max_mb = float(setting.value) if setting else 5.0
        if value.size > max_mb * 1024 * 1024:
            raise serializers.ValidationError(f'Image must be under {max_mb}MB.')
        return value

    def create(self, validated_data):
        validated_data['withdrawn_by'] = self.context['request'].user
        return super().create(validated_data)


class FundBalanceSerializer(serializers.Serializer):
    total_contributions = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_expenses = serializers.DecimalField(max_digits=12, decimal_places=2)
    balance = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField()
