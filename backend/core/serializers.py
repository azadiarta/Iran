from django.utils.html import strip_tags
from rest_framework import serializers

from core.models import ContactMessage, DefaultSetting, Permission


class RelativeImageField(serializers.ImageField):
    """An ImageField whose representation is the storage-relative URL (e.g.
    "/media/posts/x.jpg") rather than an absolute URL built from the request's
    Host header.

    Both supported reverse-proxy setups (docker-compose's Caddy, and Railway's
    frontend-service rewrites — see frontend/next.config.mjs) route /media/*
    requests to this backend under whatever origin the browser already used, so
    a relative URL always resolves correctly. This also avoids leaking an
    internal/proxy hostname (e.g. *.railway.internal) that
    request.build_absolute_uri() would otherwise produce. For S3/CDN-backed
    storage, value.url is already an absolute bucket/CDN URL and is returned
    unchanged.
    """
    def to_representation(self, value):
        if not value:
            return None
        try:
            return value.url
        except (ValueError, AttributeError):
            return None


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'codename', 'label', 'description']
        read_only_fields = fields


class DefaultSettingSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DefaultSetting
        fields = ['id', 'key', 'value', 'description', 'updated_by_name', 'updated_at']
        read_only_fields = ['id', 'key', 'updated_by_name', 'updated_at']

    def get_updated_by_name(self, obj):
        return str(obj.updated_by) if obj.updated_by else None


class ContactMessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ['name', 'contact_info', 'message']

    def validate_name(self, value):
        return strip_tags(value).strip()

    def validate_contact_info(self, value):
        return strip_tags(value).strip()

    def validate_message(self, value):
        return strip_tags(value).strip()

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['sender'] = request.user
        return super().create(validated_data)


class ContactMessageSerializer(serializers.ModelSerializer):
    sender_label = serializers.SerializerMethodField()
    # Internal admin lookup aid only (see accounts.Member.member_number) — safe
    # here because the only consumers are the admin list (can_manage_contact_messages)
    # and a member's own "my messages" view, where it can only ever be their own number.
    sender_member_number = serializers.SerializerMethodField()
    handled_by_label = serializers.SerializerMethodField()

    class Meta:
        model = ContactMessage
        fields = [
            'id', 'tracking_code', 'name', 'contact_info', 'message', 'sender_label', 'sender_member_number',
            'is_handled', 'handled_by_label', 'handled_at', 'created_at',
        ]
        read_only_fields = fields

    def get_sender_label(self, obj):
        return str(obj.sender) if obj.sender else None

    def get_sender_member_number(self, obj):
        return obj.sender.member_number if obj.sender else None

    def get_handled_by_label(self, obj):
        return str(obj.handled_by) if obj.handled_by else None
