from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.db.models import Sum
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from accounts.permissions import HasGroupPermission, IsSuperuser
from core.models import DefaultSetting
from core.pagination import paginate
from core.utils import api_error, api_success
from fund.models import Contribution, Expense
from fund.serializers import (
    ContributionCreateSerializer,
    ContributionSerializer,
    ContributionStatusSerializer,
    ExpenseCreateSerializer,
    ExpenseSerializer,
    FundBalanceSerializer,
)
from logs.models import ActivityLog


def _log(actor, action, target=None, extra_data=None, ip=None):
    actor_display = str(actor) if actor else 'guest'
    target_display = str(target) if target else ''
    target_type = None
    target_id = None
    if target:
        target_type = ContentType.objects.get_for_model(target)
        target_id = target.pk
    ActivityLog.objects.create(
        actor=actor if (actor and actor.is_authenticated) else None,
        actor_display=actor_display,
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_display=target_display,
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


class ContributionStatusUpdateView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    def patch(self, request, pk):
        try:
            contribution = Contribution.objects.get(pk=pk)
        except Contribution.DoesNotExist:
            return api_error('Contribution not found.', status_code=404)

        serializer = ContributionStatusSerializer(contribution, data=request.data, partial=True)
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)
        serializer.save()
        _log(request.user, 'contribution_status_updated', target=contribution, ip=_get_ip(request))
        return api_success(ContributionSerializer(contribution).data, message='Status updated.')


class ContributionDeleteView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser]

    def delete(self, request, pk):
        try:
            contribution = Contribution.objects.get(pk=pk)
        except Contribution.DoesNotExist:
            return api_error('Contribution not found.', status_code=404)

        _log(request.user, 'contribution_deleted', target=contribution, ip=_get_ip(request))
        contribution.delete()
        return api_success(message='Contribution deleted.')


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

        _log(request.user, 'expense_deleted', target=expense, ip=_get_ip(request))
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
