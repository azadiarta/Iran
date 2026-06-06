import json

from django.contrib import admin
from django.utils.html import mark_safe
from django.utils.translation import gettext_lazy as _

from logs.models import ActivityLog, SystemLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ['actor_display', 'action', 'target_display', 'ip_address', 'created_at']
    list_filter = ['action', 'created_at']
    search_fields = ['actor_display', 'action', 'target_display', 'ip_address']
    readonly_fields = [
        'id', 'actor', 'actor_display', 'action',
        'target_type', 'target_id', 'target_display',
        'ip_address', 'pretty_extra_data', 'created_at',
    ]
    date_hierarchy = 'created_at'

    fieldsets = [
        (_('Actor'),      {'fields': ['actor', 'actor_display', 'ip_address']}),
        (_('Action'),     {'fields': ['action', 'target_type', 'target_id', 'target_display']}),
        (_('Extra Data'), {'fields': ['pretty_extra_data']}),
        (_('Meta'),       {'fields': ['id', 'created_at'], 'classes': ['collapse']}),
    ]

    def pretty_extra_data(self, obj):
        if obj.extra_data:
            return mark_safe(
                f'<pre style="white-space:pre-wrap;word-break:break-all;">'
                f'{json.dumps(obj.extra_data, indent=2, ensure_ascii=False)}'
                f'</pre>'
            )
        return '—'
    pretty_extra_data.short_description = 'Extra Data'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SystemLog)
class SystemLogAdmin(admin.ModelAdmin):
    list_display = ['level', 'source', 'message_preview', 'ip_address', 'created_at']
    list_filter = ['level', 'source', 'created_at']
    search_fields = ['source', 'message']
    readonly_fields = [
        'id', 'level', 'source', 'message',
        'related_member', 'ip_address', 'pretty_extra_data', 'created_at',
    ]
    date_hierarchy = 'created_at'

    fieldsets = [
        (_('Log'),        {'fields': ['level', 'source', 'message']}),
        (_('Context'),    {'fields': ['related_member', 'ip_address', 'pretty_extra_data']}),
        (_('Meta'),       {'fields': ['id', 'created_at'], 'classes': ['collapse']}),
    ]

    def message_preview(self, obj):
        return obj.message[:80] + ('…' if len(obj.message) > 80 else '')
    message_preview.short_description = 'Message'

    def pretty_extra_data(self, obj):
        if obj.extra_data:
            return mark_safe(
                f'<pre style="white-space:pre-wrap;word-break:break-all;">'
                f'{json.dumps(obj.extra_data, indent=2, ensure_ascii=False)}'
                f'</pre>'
            )
        return '—'
    pretty_extra_data.short_description = 'Extra Data'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
