from rest_framework import serializers

from core.models import DefaultSetting, Permission


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
