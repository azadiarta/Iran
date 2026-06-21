from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from accounts.permissions import HasGroupPermission, IsSuperuser
from core.pagination import paginate
from core.utils import api_error, api_success
from core.validators import safe_filter
from logs.models import ActivityLog, SystemLog
from logs.serializers import ActivityLogSerializer, SystemLogSerializer


# ─── ActivityLog ──────────────────────────────────────────────────────────────

class ActivityLogListView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    def get(self, request):
        qs = ActivityLog.objects.order_by('-created_at')

        # Superuser-actor entries are invisible to every other admin — only
        # the superuser themselves can see their own activity.
        if not request.user.is_superuser:
            qs = qs.exclude(actor__is_superuser=True)

        actor = request.query_params.get('actor')
        if actor:
            qs = safe_filter(qs, actor__id=actor)

        action = request.query_params.get('action')
        if action:
            qs = qs.filter(action=action)

        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            qs = safe_filter(qs, created_at__date__gte=date_from)
        if date_to:
            qs = safe_filter(qs, created_at__date__lte=date_to)

        ip = request.query_params.get('ip_address')
        if ip:
            qs = safe_filter(qs, ip_address=ip)

        return paginate(qs, request, ActivityLogSerializer, page_size=25)


class ActivityLogDetailView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    def get(self, request, pk):
        try:
            log = ActivityLog.objects.get(pk=pk)
        except ActivityLog.DoesNotExist:
            return api_error('Activity log not found.', status_code=404)
        if not request.user.is_superuser and log.actor_id and log.actor.is_superuser:
            return api_error('Activity log not found.', status_code=404)
        return api_success(ActivityLogSerializer(log).data)


# ─── SystemLog ────────────────────────────────────────────────────────────────

class SystemLogListView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser]

    def get(self, request):
        qs = SystemLog.objects.select_related('related_member').order_by('-created_at')

        level = request.query_params.get('level')
        if level:
            qs = qs.filter(level=level)

        source = request.query_params.get('source')
        if source:
            qs = qs.filter(source__icontains=source)

        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            qs = safe_filter(qs, created_at__date__gte=date_from)
        if date_to:
            qs = safe_filter(qs, created_at__date__lte=date_to)

        return paginate(qs, request, SystemLogSerializer, page_size=25)


class SystemLogDetailView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser]

    def get(self, request, pk):
        try:
            log = SystemLog.objects.get(pk=pk)
        except SystemLog.DoesNotExist:
            return api_error('System log not found.', status_code=404)
        return api_success(SystemLogSerializer(log).data)
