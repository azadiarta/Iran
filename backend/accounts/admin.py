from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.contenttypes.models import ContentType
from django.utils.translation import gettext_lazy as _

from accounts.models import AccessGroup, Member
from core.models import DefaultSetting
from fund.models import Contribution, Expense
from logs.models import ActivityLog


def _get_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    return forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')


class ContributionInline(admin.TabularInline):
    model = Contribution
    fk_name = 'contributor'
    fields = ['amount', 'currency', 'payment_method', 'status', 'created_at']
    readonly_fields = ['amount', 'currency', 'payment_method', 'status', 'created_at']
    extra = 0
    can_delete = False
    show_change_link = True
    verbose_name_plural = 'Last 5 Contributions'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        recent_pks = list(qs.order_by('-created_at').values_list('pk', flat=True)[:5])
        return qs.filter(pk__in=recent_pks).order_by('-created_at')


class ExpenseInline(admin.TabularInline):
    model = Expense
    fk_name = 'withdrawn_by'
    fields = ['amount', 'short_reason', 'expense_date', 'created_at']
    readonly_fields = ['amount', 'short_reason', 'expense_date', 'created_at']
    extra = 0
    can_delete = False
    show_change_link = True
    verbose_name_plural = 'Last 5 Expenses'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        recent_pks = list(qs.order_by('-expense_date').values_list('pk', flat=True)[:5])
        return qs.filter(pk__in=recent_pks).order_by('-expense_date')


@admin.register(Member)
class MemberAdmin(UserAdmin):
    ordering = ['full_name']
    list_display = ['full_name', 'display_name', 'email', 'phone', 'group', 'is_active', 'created_at']
    list_filter = ['group', 'is_active']
    search_fields = ['full_name', 'email', 'phone', 'display_name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    filter_horizontal = []
    inlines = [ContributionInline, ExpenseInline]
    actions = ['activate_members', 'deactivate_members']

    fieldsets = (
        (_('Personal Info'),       {'fields': ('full_name', 'display_name')}),
        (_('Login Credentials'),   {'fields': ('email', 'phone', 'password')}),
        (_('Access'),              {'fields': ('group', 'is_active', 'is_staff')}),
        (_('Timestamps'),          {'fields': ('id', 'created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('full_name', 'email', 'phone', 'password1', 'password2'),
        }),
    )

    @admin.action(description='Activate selected members')
    def activate_members(self, request, queryset):
        qs = queryset.filter(is_superuser=False)
        pks = list(qs.values_list('pk', flat=True))
        qs.update(is_active=True)
        for pk in pks:
            ActivityLog.objects.create(
                actor=request.user,
                actor_display=str(request.user),
                action='member_activated_via_admin',
                target_type=ContentType.objects.get_for_model(Member),
                target_id=pk,
                target_display=str(Member.objects.filter(pk=pk).first() or pk),
                ip_address=_get_ip(request),
            )
        self.message_user(request, f'{len(pks)} member(s) activated.')

    @admin.action(description='Deactivate selected members (not superusers)')
    def deactivate_members(self, request, queryset):
        qs = queryset.filter(is_superuser=False)
        pks = list(qs.values_list('pk', flat=True))
        qs.update(is_active=False)
        for pk in pks:
            ActivityLog.objects.create(
                actor=request.user,
                actor_display=str(request.user),
                action='member_deactivated_via_admin',
                target_type=ContentType.objects.get_for_model(Member),
                target_id=pk,
                target_display=str(Member.objects.filter(pk=pk).first() or pk),
                ip_address=_get_ip(request),
            )
        self.message_user(request, f'{len(pks)} member(s) deactivated.')

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if change:
            ActivityLog.objects.create(
                actor=request.user,
                actor_display=str(request.user),
                action='member_updated_via_admin',
                target_type=ContentType.objects.get_for_model(obj),
                target_id=obj.pk,
                target_display=str(obj),
                ip_address=_get_ip(request),
            )


@admin.register(AccessGroup)
class AccessGroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'description', 'is_default', 'member_count', 'created_at']
    search_fields = ['name']
    filter_horizontal = ['permissions']
    readonly_fields = ['id', 'created_at', 'updated_at']
    actions = ['set_as_default']

    fieldsets = [
        (None,         {'fields': ['name', 'description', 'is_default', 'permissions']}),
        (_('Meta'),    {'fields': ['id', 'created_at', 'updated_at'], 'classes': ['collapse']}),
    ]

    def member_count(self, obj):
        return obj.members.count()
    member_count.short_description = 'Members'

    @admin.action(description='Set as default group')
    def set_as_default(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(request, 'Select exactly one group to set as default.', level='error')
            return
        group = queryset.first()
        AccessGroup.objects.filter(is_default=True).exclude(pk=group.pk).update(is_default=False)
        group.is_default = True
        group.save(update_fields=['is_default'])
        setting, _ = DefaultSetting.objects.get_or_create(
            key='default_group',
            defaults={'value': str(group.id), 'updated_by': request.user},
        )
        setting.value = str(group.id)
        setting.updated_by = request.user
        setting.save(update_fields=['value', 'updated_by', 'updated_at'])
        ActivityLog.objects.create(
            actor=request.user,
            actor_display=str(request.user),
            action='default_group_changed_via_admin',
            target_type=ContentType.objects.get_for_model(group),
            target_id=group.pk,
            target_display=str(group),
            ip_address=_get_ip(request),
        )
        self.message_user(request, f'"{group.name}" set as default group.')
