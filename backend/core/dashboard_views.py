from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from accounts.models import Member
from accounts.permissions import HasGroupPermission
from core.models import DefaultSetting
from core.utils import api_success
from fund.models import Contribution, Expense
from fund.serializers import ContributionSerializer, ExpenseSerializer
from posts.models import Comment, Post
from posts.serializers import CommentSerializer, PostSerializer


class DashboardView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_view_dashboard')]

    def get(self, request):
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Fund
        total_contributions = (
            Contribution.objects.filter(status=Contribution.Status.COMPLETED)
            .aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        )
        total_expenses = (
            Expense.objects.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        )
        contributions_this_month = (
            Contribution.objects.filter(
                status=Contribution.Status.COMPLETED,
                created_at__gte=month_start,
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        )
        expenses_this_month = (
            Expense.objects.filter(expense_date__gte=month_start.date())
            .aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        )

        setting = DefaultSetting.objects.filter(key='default_currency').first()
        currency = setting.value if setting else 'GBP'

        # Members
        total_members = Member.objects.count()
        active_members = Member.objects.filter(is_active=True).count()

        # Recent records
        recent_contributions = Contribution.objects.select_related('contributor').order_by('-created_at')[:5]
        recent_expenses = Expense.objects.select_related('withdrawn_by').order_by('-expense_date')[:5]
        recent_posts = Post.objects.select_related('author').prefetch_related('images').order_by('-created_at')[:5]

        data = {
            'fund': {
                'balance': total_contributions - total_expenses,
                'total_contributions': total_contributions,
                'total_expenses': total_expenses,
                'currency': currency,
                'contributions_this_month': contributions_this_month,
                'expenses_this_month': expenses_this_month,
            },
            'members': {
                'total': total_members,
                'active': active_members,
                'inactive': total_members - active_members,
            },
            'recent_contributions': ContributionSerializer(recent_contributions, many=True).data,
            'recent_expenses': ExpenseSerializer(recent_expenses, many=True).data,
            'recent_posts': PostSerializer(recent_posts, many=True).data,
        }

        can_approve = request.user.is_superuser or (
            request.user.group and
            request.user.group.permissions.filter(codename='can_approve_comments').exists()
        )
        if can_approve:
            pending = Comment.objects.select_related('author').filter(
                is_approved=False
            ).order_by('-created_at')[:5]
            data['pending_comments'] = CommentSerializer(pending, many=True).data

        return api_success(data)
