from rest_framework import serializers

from core.models import DefaultSetting, Permission


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
