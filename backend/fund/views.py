from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.db.models import Q, Sum
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from accounts.permissions import HasGroupPermission
from core.log_utils import actor_display_for, target_display_for
from core.models import DefaultSetting
from core.pagination import paginate
from core.utils import api_error, api_success
from fund.models import Contribution, Expense
from fund.serializers import (
    ContributionAdminDetailSerializer,
    ContributionAdminEditSerializer,
    ContributionCreateSerializer,
    ContributionManualCreateSerializer,
    ContributionPublicListSerializer,
    ContributionSerializer,
    ContributionStatusSerializer,
    ExpenseCreateSerializer,
    ExpenseSerializer,
    FundBalanceSerializer,
    MyContributionSerializer,
)
from logs.models import ActivityLog


def _log(actor, action, target=None, extra_data=None, ip=None):
    target_type = None
    target_id = None
    if target:
        target_type = ContentType.objects.get_for_model(target)
        target_id = target.pk
    ActivityLog.objects.create(
        actor=actor,
        actor_display=actor_display_for(actor),
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_display=target_display_for(target),
        ip_address=ip,
        extra_data=extra_data,
    )


def _get_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    return forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')


# ─── Contribution ──────────────────────────────────────────────────────────────

class ContributionListView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_view_balance')]

    def get(self, request):
        qs = Contribution.objects.select_related('contributor').order_by('-created_at')

        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        method_filter = request.query_params.get('payment_method')
        if method_filter:
            qs = qs.filter(payment_method=method_filter)

        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        contributor_id = request.query_params.get('contributor')
        if contributor_id:
            qs = qs.filter(contributor__id=contributor_id)

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(guest_name__icontains=search)
                | Q(contributor__full_name__icontains=search)
                | Q(contributor__display_name__icontains=search)
                | Q(tracking_code__icontains=search)
            )

        return paginate(qs, request, ContributionSerializer)


class ContributionCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ContributionCreateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)
        contribution = serializer.save()
        actor = request.user if request.user.is_authenticated else None
        _log(actor, 'contribution_created', target=contribution, ip=_get_ip(request))
        return api_success(
            ContributionSerializer(contribution).data,
            message='Contribution submitted.',
            status_code=201,
        )


class ContributionManualCreateView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    def post(self, request):
        serializer = ContributionManualCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)
        contribution = serializer.save()
        _log(request.user, 'contribution_added_manually', target=contribution, ip=_get_ip(request))
        return api_success(
            ContributionSerializer(contribution).data,
            message='Contribution added.',
            status_code=201,
        )


class ContributionStatusUpdateView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    def patch(self, request, pk):
        try:
            contribution = Contribution.objects.get(pk=pk)
        except Contribution.DoesNotExist:
            return api_error('Contribution not found.', status_code=404)

        before_status = contribution.status
        serializer = ContributionStatusSerializer(contribution, data=request.data, partial=True)
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)
        serializer.save()
        _log(
            request.user, 'contribution_status_updated', target=contribution,
            extra_data={'before': before_status, 'after': contribution.status},
            ip=_get_ip(request),
        )
        return api_success(ContributionSerializer(contribution).data, message='Status updated.')


class ContributionPublicListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = Contribution.objects.filter(
            status=Contribution.Status.COMPLETED,
            show_in_public_list=True,
        ).select_related('contributor').order_by('-created_at')
        return paginate(qs, request, ContributionPublicListSerializer)


class ContributionAdminDetailView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    def get(self, request, pk):
        try:
            contribution = Contribution.objects.select_related('contributor').get(pk=pk)
        except Contribution.DoesNotExist:
            return api_error('Contribution not found.', status_code=404)
        return api_success(ContributionAdminDetailSerializer(contribution, context={'request': request}).data)


class ContributionAdminEditView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    EDITABLE_FIELDS = [
        'amount', 'currency', 'guest_name', 'payment_method', 'status', 'notes',
        'rejection_reason', 'show_in_public_list', 'display_name_choice',
        'public_display_name', 'message',
    ]

    def patch(self, request, pk):
        try:
            contribution = Contribution.objects.select_related('contributor').get(pk=pk)
        except Contribution.DoesNotExist:
            return api_error('Contribution not found.', status_code=404)

        before = {field: str(getattr(contribution, field)) for field in self.EDITABLE_FIELDS}

        serializer = ContributionAdminEditSerializer(contribution, data=request.data, partial=True)
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)
        serializer.save()

        after = {field: str(getattr(contribution, field)) for field in self.EDITABLE_FIELDS}
        _log(
            request.user, 'contribution_edited_by_admin', target=contribution,
            extra_data={'before': before, 'after': after},
            ip=_get_ip(request),
        )
        return api_success(ContributionAdminDetailSerializer(contribution, context={'request': request}).data, message='Contribution updated.')


class MyContributionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Contribution.objects.filter(contributor=request.user).order_by('-created_at')
        total_approved = qs.filter(status=Contribution.Status.COMPLETED).aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')
        response = paginate(qs, request, MyContributionSerializer)
        response.data['total_approved'] = str(total_approved)
        return response


# ─── Expense ──────────────────────────────────────────────────────────────────

class ExpenseListView(APIView):

    def get_permissions(self):
        setting = DefaultSetting.objects.filter(key='expense_list_visibility').first()
        visibility = setting.value if setting else 'members_only'

        if visibility == 'all':
            return [AllowAny()]
        if visibility == 'admin_only':
            return [IsAuthenticated(), HasGroupPermission('can_manage_permissions')()]
        return [IsAuthenticated()]

    def get(self, request):
        qs = Expense.objects.select_related('withdrawn_by').order_by('-expense_date')

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(Q(short_reason__icontains=search) | Q(description__icontains=search))

        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(expense_date__gte=date_from)
        if date_to:
            qs = qs.filter(expense_date__lte=date_to)

        amount_min = request.query_params.get('amount_min')
        amount_max = request.query_params.get('amount_max')
        if amount_min:
            qs = qs.filter(amount__gte=amount_min)
        if amount_max:
            qs = qs.filter(amount__lte=amount_max)

        withdrawn_by = request.query_params.get('withdrawn_by')
        if withdrawn_by:
            qs = qs.filter(withdrawn_by__id=withdrawn_by)

        return paginate(qs, request, ExpenseSerializer)


class ExpenseDetailView(APIView):

    def get_permissions(self):
        setting = DefaultSetting.objects.filter(key='expense_list_visibility').first()
        visibility = setting.value if setting else 'members_only'

        if visibility == 'all':
            return [AllowAny()]
        if visibility == 'admin_only':
            return [IsAuthenticated(), HasGroupPermission('can_manage_permissions')()]
        return [IsAuthenticated()]

    def get(self, request, pk):
        try:
            expense = Expense.objects.select_related('withdrawn_by').get(pk=pk)
        except Expense.DoesNotExist:
            return api_error('Expense not found.', status_code=404)

        return api_success(ExpenseSerializer(expense, context={'request': request}).data)


class ExpenseCreateView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_expense')]

    def post(self, request):
        serializer = ExpenseCreateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)
        expense = serializer.save()
        _log(request.user, 'expense_created', target=expense, ip=_get_ip(request))
        return api_success(ExpenseSerializer(expense, context={'request': request}).data, message='Expense recorded.', status_code=201)


class ExpenseDeleteView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    def delete(self, request, pk):
        try:
            expense = Expense.objects.get(pk=pk)
        except Expense.DoesNotExist:
            return api_error('Expense not found.', status_code=404)

        _log(request.user, 'expense_deleted', target=expense, ip=_get_ip(request), extra_data={
            'amount': str(expense.amount),
            'short_reason': expense.short_reason,
            'description': expense.description,
            'expense_date': str(expense.expense_date),
            'withdrawn_by': str(expense.withdrawn_by_id) if expense.withdrawn_by_id else None,
        })
        expense.delete()
        return api_success(message='Expense deleted.')


# ─── Fund Balance ──────────────────────────────────────────────────────────────

class FundBalanceView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_view_balance')]

    def get(self, request):
        total_contributions = (
            Contribution.objects.filter(status=Contribution.Status.COMPLETED)
            .aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        )
        total_expenses = (
            Expense.objects.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        )
        balance = total_contributions - total_expenses

        setting = DefaultSetting.objects.filter(key='default_currency').first()
        currency = setting.value if setting else 'GBP'

        data = {
            'total_contributions': total_contributions,
            'total_expenses': total_expenses,
            'balance': balance,
            'currency': currency,
        }
        return api_success(FundBalanceSerializer(data).data)
