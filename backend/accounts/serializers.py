from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import AccessGroup, Member
from core.models import Permission


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = Member
        fields = ['full_name', 'display_name', 'phone', 'email', 'password', 'password_confirm']

    def validate_email(self, value):
        return value or None

    def validate_phone(self, value):
        return value or None

    def validate(self, data):
        if not data.get('phone') and not data.get('email'):
            raise serializers.ValidationError('At least one of phone or email is required.')

        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password': 'Passwords do not match.'})

        if data.get('email') and Member.objects.filter(email=data['email']).exists():
            raise serializers.ValidationError({'email': 'This email is already registered.'})

        if data.get('phone') and Member.objects.filter(phone=data['phone']).exists():
            raise serializers.ValidationError({'phone': 'This phone number is already registered.'})

        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')

        member = Member(**validated_data)
        member.group = self._get_default_group()
        member.set_password(password)
        member.save()
        return member

    def _get_default_group(self):
        # Find the group that has exactly: can_contribute and can_comment (and nothing else)
        target_codenames = {'can_contribute', 'can_comment'}
        for group in AccessGroup.objects.prefetch_related('permissions'):
            group_codenames = set(group.permissions.values_list('codename', flat=True))
            if group_codenames == target_codenames:
                return group

        # Fallback: any group with the fewest permissions
        group = AccessGroup.objects.order_by('name').first()
        if not group:
            raise serializers.ValidationError(
                'No access groups are configured. Ask an admin to set up groups first.'
            )
        return group


class LoginSerializer(serializers.Serializer):
    credential = serializers.CharField(help_text='Phone number or email address')
    password = serializers.CharField(write_only=True)


class MemberProfileSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True, default=None)
    group_permissions = serializers.SerializerMethodField()

    class Meta:
        model = Member
        fields = [
            'id', 'full_name', 'display_name', 'email', 'phone',
            'group_name', 'group_permissions', 'is_active', 'created_at',
        ]
        read_only_fields = fields

    def get_group_permissions(self, obj):
        if obj.is_superuser:
            return ['*']
        if not obj.group:
            return []
        return list(obj.group.permissions.values_list('codename', flat=True))
