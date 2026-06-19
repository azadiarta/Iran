from django.contrib.contenttypes.models import ContentType
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from accounts.models import AccessGroup
from accounts.permissions import HasGroupPermission, IsSuperuser
from accounts.serializers import (
    AccessGroupCreateSerializer,
    AccessGroupSerializer,
    AccessGroupUpdateSerializer,
)
from core.log_utils import actor_display_for, target_display_for
from core.models import DefaultSetting
from core.utils import api_error, api_success
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


class AccessGroupListView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    def get(self, request):
        groups = AccessGroup.objects.prefetch_related('permissions', 'members').all()
        return api_success(AccessGroupSerializer(groups, many=True).data)


class AccessGroupCreateView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    def post(self, request):
        serializer = AccessGroupCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)
        group = serializer.save()
        _log(request.user, 'group_created', target=group, ip=_get_ip(request))
        return api_success(AccessGroupSerializer(group).data, message='Group created.', status_code=201)


class AccessGroupUpdateView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    def patch(self, request, pk):
        try:
            group = AccessGroup.objects.get(pk=pk)
        except AccessGroup.DoesNotExist:
            return api_error('Group not found.', status_code=404)

        before = {
            'name': group.name,
            'description': group.description,
            'permissions': list(group.permissions.values_list('codename', flat=True)),
        }

        serializer = AccessGroupUpdateSerializer(group, data=request.data, partial=True)
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)
        serializer.save()
        group.refresh_from_db()

        after = {
            'name': group.name,
            'description': group.description,
            'permissions': list(group.permissions.values_list('codename', flat=True)),
        }
        _log(request.user, 'group_updated', target=group,
             extra_data={'before': before, 'after': after}, ip=_get_ip(request))
        return api_success(AccessGroupSerializer(group).data, message='Group updated.')


class AccessGroupSetDefaultView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser]

    def patch(self, request, pk):
        try:
            group = AccessGroup.objects.get(pk=pk)
        except AccessGroup.DoesNotExist:
            return api_error('Group not found.', status_code=404)

        old_default = AccessGroup.objects.filter(is_default=True).first()
        old_name = str(old_default) if old_default else None

        group.is_default = True
        group.save()  # AccessGroup.save() handles clearing other defaults

        # Keep DefaultSetting in sync
        DefaultSetting.objects.update_or_create(
            key='default_group',
            defaults={'value': str(group.pk), 'updated_by': request.user},
        )

        _log(request.user, 'default_group_changed', target=group,
             extra_data={'old_default': old_name, 'new_default': str(group)},
             ip=_get_ip(request))
        return api_success(AccessGroupSerializer(group).data, message='Default group updated.')


class AccessGroupDeleteView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser]

    def delete(self, request, pk):
        try:
            group = AccessGroup.objects.get(pk=pk)
        except AccessGroup.DoesNotExist:
            return api_error('Group not found.', status_code=404)

        if group.is_default:
            return api_error('Cannot delete the default group.', status_code=400)

        _log(request.user, 'group_deleted', extra_data={
            'name': group.name,
            'description': group.description,
            'permissions': list(group.permissions.values_list('codename', flat=True)),
            'member_count': group.members.count(),
        }, ip=_get_ip(request))
        group.delete()  # core/signals.py on_access_group_delete moves members to default
        return api_success(message='Group deleted.')
