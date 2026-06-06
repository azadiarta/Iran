from rest_framework import serializers

from logs.models import ActivityLog, SystemLog


class ActivityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityLog
        fields = ['id', 'actor_display', 'action', 'target_display',
                  'ip_address', 'extra_data', 'created_at']
        read_only_fields = fields


class SystemLogSerializer(serializers.ModelSerializer):
    related_member_name = serializers.SerializerMethodField()

    class Meta:
        model = SystemLog
        fields = ['id', 'level', 'source', 'message', 'extra_data',
                  'related_member_name', 'ip_address', 'created_at']
        read_only_fields = fields

    def get_related_member_name(self, obj):
        return str(obj.related_member) if obj.related_member else None
