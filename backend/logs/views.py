from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from accounts.permissions import HasGroupPermission, IsSuperuser
from core.utils import api_error, api_success
from logs.models import ActivityLog, SystemLog
from logs.serializers import ActivityLogSerializer, SystemLogSerializer


def _paginate(queryset, request, serializer_class, page_size=25):
    paginator = PageNumberPagination()
    paginator.page_size = page_size
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(serializer_class(page, many=True).data)


# ─── ActivityLog ──────────────────────────────────────────────────────────────

class ActivityLogListView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    def get(self, request):
        qs = ActivityLog.objects.order_by('-created_at')

        actor = request.query_params.get('actor')
        if actor:
            qs = qs.filter(actor__id=actor)

        action = request.query_params.get('action')
        if action:
            qs = qs.filter(action=action)

        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        ip = request.query_params.get('ip_address')
        if ip:
            qs = qs.filter(ip_address=ip)

        return _paginate(qs, request, ActivityLogSerializer)


class ActivityLogDetailView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    def get(self, request, pk):
        try:
            log = ActivityLog.objects.get(pk=pk)
        except ActivityLog.DoesNotExist:
            return api_error('Activity log not found.', status_code=404)
        return api_success(ActivityLogSerializer(log).data)


# ─── SystemLog ────────────────────────────────────────────────────────────────

class SystemLogListView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser]

    def get(self, request):
        qs = SystemLog.objects.order_by('-created_at')

        level = request.query_params.get('level')
        if level:
            qs = qs.filter(level=level)

        source = request.query_params.get('source')
        if source:
            qs = qs.filter(source__icontains=source)

        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        return _paginate(qs, request, SystemLogSerializer)


class SystemLogDetailView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser]

    def get(self, request, pk):
        try:
            log = SystemLog.objects.get(pk=pk)
        except SystemLog.DoesNotExist:
            return api_error('System log not found.', status_code=404)
        return api_success(SystemLogSerializer(log).data)
