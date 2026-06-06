from decimal import Decimal

from django.contrib import admin
from django.contrib.contenttypes.models import ContentType
from django.db.models import Sum
from django.utils.html import mark_safe
from django.utils.translation import gettext_lazy as _

from core.models import DefaultSetting
from fund.models import Contribution, Expense
from logs.models import ActivityLog


def _get_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    return forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')


def _fund_balance_str():
    total_in = (
        Contribution.objects.filter(status=Contribution.Status.COMPLETED)
        .aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
    )
    total_out = Expense.objects.aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
    balance = total_in - total_out
    setting = DefaultSetting.objects.filter(key='default_currency').first()
    currency = setting.value if setting else 'GBP'
    return f'{currency} {balance:,.2f}'


@admin.register(Contribution)
class ContributionAdmin(admin.ModelAdmin):
    list_display = ['contributor_display', 'amount', 'currency', 'payment_method', 'status', 'created_at']
    list_filter = ['status', 'payment_method', 'created_at']
    search_fields = ['guest_name', 'notes']
    readonly_fields = ['id', 'created_at', 'updated_at', 'receipt_preview']
    date_hierarchy = 'created_at'
    actions = ['approve_contributions', 'reject_contributions']
    change_list_template = 'admin/fund/contribution/change_list.html'

    fieldsets = [
        (_('Contributor'),   {'fields': ['contributor', 'guest_name']}),
        (_('Payment'),       {'fields': ['amount', 'currency', 'payment_method', 'status', 'notes']}),
        (_('Receipt'),       {'fields': ['receipt_image', 'receipt_preview']}),
        (_('Meta'),          {'fields': ['id', 'created_at', 'updated_at'], 'classes': ['collapse']}),
    ]

    def contributor_display(self, obj):
        if obj.contributor:
            return str(obj.contributor)
        return f'{obj.guest_name} (Guest)' if obj.guest_name else '— (Guest)'
    contributor_display.short_description = 'Contributor'

    def receipt_preview(self, obj):
        if obj.receipt_image:
            return mark_safe(
                f'<img src="{obj.receipt_image.url}" '
                f'style="max-height:200px;max-width:300px;border-radius:4px;" />'
            )
        return '—'
    receipt_preview.short_description = 'Receipt Preview'

    @admin.action(description='Approve selected contributions (set completed)')
    def approve_contributions(self, request, queryset):
        updated = queryset.update(status=Contribution.Status.COMPLETED)
        for obj in queryset:
            ActivityLog.objects.create(
                actor=request.user,
                actor_display=str(request.user),
                action='contribution_approved_via_admin',
                target_type=ContentType.objects.get_for_model(obj),
                target_id=obj.pk,
                target_display=str(obj),
                ip_address=_get_ip(request),
            )
        self.message_user(request, f'{updated} contribution(s) approved.')

    @admin.action(description='Reject selected contributions (set failed)')
    def reject_contributions(self, request, queryset):
        updated = queryset.update(status=Contribution.Status.FAILED)
        for obj in queryset:
            ActivityLog.objects.create(
                actor=request.user,
                actor_display=str(request.user),
                action='contribution_rejected_via_admin',
                target_type=ContentType.objects.get_for_model(obj),
                target_id=obj.pk,
                target_display=str(obj),
                ip_address=_get_ip(request),
            )
        self.message_user(request, f'{updated} contribution(s) rejected.')

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        try:
            extra_context['fund_balance'] = _fund_balance_str()
        except Exception:
            pass
        return super().changelist_view(request, extra_context=extra_context)


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ['withdrawn_by', 'amount', 'short_reason', 'expense_date', 'created_at']
    list_filter = ['expense_date', 'withdrawn_by']
    search_fields = ['short_reason', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at', 'receipt_preview']
    date_hierarchy = 'expense_date'
    change_list_template = 'admin/fund/expense/change_list.html'

    fieldsets = [
        (_('Expense'),       {'fields': ['withdrawn_by', 'amount', 'short_reason', 'description', 'expense_date']}),
        (_('Receipt'),       {'fields': ['receipt_image', 'receipt_preview']}),
        (_('Meta'),          {'fields': ['id', 'created_at', 'updated_at'], 'classes': ['collapse']}),
    ]

    def receipt_preview(self, obj):
        if obj.receipt_image:
            return mark_safe(
                f'<img src="{obj.receipt_image.url}" '
                f'style="max-height:200px;max-width:300px;border-radius:4px;" />'
            )
        return '—'
    receipt_preview.short_description = 'Receipt Preview'

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        try:
            extra_context['fund_balance'] = _fund_balance_str()
        except Exception:
            pass
        return super().changelist_view(request, extra_context=extra_context)
