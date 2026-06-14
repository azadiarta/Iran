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
        from core.models import DefaultSetting
        setting = DefaultSetting.objects.filter(key='default_group').first()
        if setting and setting.value:
            try:
                group = AccessGroup.objects.get(pk=setting.value)
                return group
            except (AccessGroup.DoesNotExist, Exception):
                pass

        group = AccessGroup.objects.filter(is_default=True).first()
        if group:
            return group

        group = AccessGroup.objects.order_by('name').first()
        if not group:
            raise serializers.ValidationError(
                'No access groups are configured. Ask an admin to set up groups first.'
            )
        return group


class MemberCreateSerializer(RegisterSerializer):
    group_id = serializers.PrimaryKeyRelatedField(
        source='group', queryset=AccessGroup.objects.all(),
        required=False, allow_null=True,
    )

    class Meta(RegisterSerializer.Meta):
        fields = RegisterSerializer.Meta.fields + ['group_id']

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        group = validated_data.pop('group', None)
        member = Member(**validated_data)
        member.group = group or self._get_default_group()
        member.set_password(password)
        member.save()
        return member


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
            'group_name', 'group_permissions', 'is_active', 'is_superuser', 'created_at',
        ]
        read_only_fields = fields

    def get_group_permissions(self, obj):
        if obj.is_superuser:
            return ['*']
        if not obj.group:
            return []
        return list(obj.group.permissions.values_list('codename', flat=True))


# ─── Member management serializers ────────────────────────────────────────────

class MemberListSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True, default=None)

    class Meta:
        model = Member
        fields = ['id', 'full_name', 'display_name', 'group_name', 'is_active', 'created_at']
        read_only_fields = fields


class MemberDetailSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True, default=None)
    group_permissions = serializers.SerializerMethodField()

    class Meta:
        model = Member
        fields = ['id', 'full_name', 'display_name', 'email', 'phone',
                  'group_name', 'group_permissions', 'is_active', 'created_at']
        read_only_fields = fields

    def get_group_permissions(self, obj):
        if not obj.group:
            return []
        return list(obj.group.permissions.values_list('codename', flat=True))


class MemberUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = ['full_name', 'display_name', 'email', 'phone']
        extra_kwargs = {
            'full_name':     {'required': False},
            'display_name':  {'required': False},
            'email':         {'required': False, 'allow_null': True},
            'phone':         {'required': False, 'allow_null': True},
        }

    def validate_email(self, value):
        return value or None

    def validate_phone(self, value):
        return value or None

    def validate(self, data):
        instance = self.instance
        phone = data.get('phone', instance.phone)
        email = data.get('email', instance.email)
        if not phone and not email:
            raise serializers.ValidationError('At least one of phone or email must remain.')
        if data.get('email'):
            if Member.objects.filter(email=data['email']).exclude(pk=instance.pk).exists():
                raise serializers.ValidationError({'email': 'Email already in use.'})
        if data.get('phone'):
            if Member.objects.filter(phone=data['phone']).exclude(pk=instance.pk).exists():
                raise serializers.ValidationError({'phone': 'Phone already in use.'})
        return data


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_new_password = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_new_password']:
            raise serializers.ValidationError({'new_password': 'Passwords do not match.'})
        return data


# ─── AccessGroup management serializers ───────────────────────────────────────

class _PermissionMinimalSerializer(serializers.Serializer):
    codename = serializers.CharField(read_only=True)
    label = serializers.CharField(read_only=True)


class AccessGroupSerializer(serializers.ModelSerializer):
    permissions = _PermissionMinimalSerializer(many=True, read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = AccessGroup
        fields = ['id', 'name', 'description', 'is_default', 'permissions', 'member_count', 'created_at']
        read_only_fields = ['id', 'is_default', 'created_at']

    def get_member_count(self, obj):
        return obj.members.count()


class AccessGroupCreateSerializer(serializers.ModelSerializer):
    permission_ids = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False, default=list,
    )

    class Meta:
        model = AccessGroup
        fields = ['name', 'description', 'permission_ids']

    def create(self, validated_data):
        permission_ids = validated_data.pop('permission_ids', [])
        group = AccessGroup.objects.create(**validated_data)
        required = Permission.objects.filter(codename__in=['can_contribute', 'can_comment'])
        group.permissions.set(required)
        if permission_ids:
            extra = Permission.objects.filter(codename__in=permission_ids)
            group.permissions.add(*extra)
        return group


class AccessGroupUpdateSerializer(serializers.ModelSerializer):
    permission_ids = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False,
    )

    class Meta:
        model = AccessGroup
        fields = ['name', 'description', 'permission_ids']
        extra_kwargs = {
            'name':        {'required': False},
            'description': {'required': False},
        }

    def update(self, instance, validated_data):
        permission_ids = validated_data.pop('permission_ids', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if permission_ids is not None:
            required_codenames = {'can_contribute', 'can_comment'}
            all_codenames = set(permission_ids) | required_codenames
            instance.permissions.set(Permission.objects.filter(codename__in=all_codenames))
        return instance
