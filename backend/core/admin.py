import json

from django.contrib import admin
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from django.utils.html import mark_safe
from django.utils.translation import gettext_lazy as _

from core.models import ContactMessage, DefaultSetting, Permission
from logs.models import ActivityLog


def _get_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    return forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ['codename', 'label', 'description']
    search_fields = ['codename', 'label']
    readonly_fields = ['id', 'created_at']

    fieldsets = [
        (None, {'fields': ['codename', 'label', 'description']}),
        (_('Meta'), {'fields': ['id', 'created_at'], 'classes': ['collapse']}),
    ]


class SettingCategoryFilter(admin.SimpleListFilter):
    title = _('Category')
    parameter_name = 'category'

    def lookups(self, request, model_admin):
        return [
            ('general',          _('General')),
            ('visibility',       _('Visibility')),
            ('payment_manual',   _('Manual Bank Transfer')),
            ('payment_paypal',   _('PayPal')),
            ('payment_stripe',   _('Stripe (Future)')),
            ('payment_google',   _('Google Pay (Future)')),
        ]

    def queryset(self, request, queryset):
        val = self.value()
        if not val:
            return queryset
        prefix_map = {
            'general':        [Q(key__startswith='default_') | Q(key__startswith='require_') | Q(key__startswith='max_')],
            'visibility':     [Q(key__endswith='_visibility')],
            'payment_manual': [Q(key__startswith='payment_manual_')],
            'payment_paypal': [Q(key__startswith='payment_paypal_')],
            'payment_stripe': [Q(key__startswith='payment_stripe_')],
            'payment_google': [Q(key__startswith='payment_google_pay_')],
        }
        filters = prefix_map.get(val, [])
        if not filters:
            return queryset
        combined = filters[0]
        for f in filters[1:]:
            combined |= f
        return queryset.filter(combined)


@admin.register(DefaultSetting)
class DefaultSettingAdmin(admin.ModelAdmin):
    list_display = ['key', 'value', 'description', 'updated_by', 'updated_at']
    search_fields = ['key', 'value']
    list_filter = [SettingCategoryFilter]
    readonly_fields = ['id', 'created_at', 'updated_at', 'updated_by']

    fieldsets = [
        (_('Setting'), {'fields': ['key', 'value', 'description']}),
        (_('Meta'), {'fields': ['id', 'updated_by', 'created_at', 'updated_at'], 'classes': ['collapse']}),
    ]

    def get_readonly_fields(self, request, obj=None):
        if obj:
            return ['id', 'key', 'created_at', 'updated_at', 'updated_by']
        return ['id', 'created_at', 'updated_at', 'updated_by']

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)
        ActivityLog.objects.create(
            actor=request.user,
            actor_display=str(request.user),
            action='setting_updated_via_admin',
            target_type=ContentType.objects.get_for_model(obj),
            target_id=obj.pk,
            target_display=str(obj),
            ip_address=_get_ip(request),
            extra_data={'key': obj.key, 'value': obj.value},
        )


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ['name', 'contact_info', 'is_handled', 'handled_by', 'created_at']
    list_filter = ['is_handled']
    search_fields = ['name', 'contact_info', 'message']
    readonly_fields = ['id', 'sender', 'handled_by', 'handled_at', 'created_at']

    fieldsets = [
        (None,      {'fields': ['name', 'contact_info', 'message', 'sender']}),
        (_('Status'), {'fields': ['is_handled', 'handled_by', 'handled_at']}),
        (_('Meta'), {'fields': ['id', 'created_at'], 'classes': ['collapse']}),
    ]
