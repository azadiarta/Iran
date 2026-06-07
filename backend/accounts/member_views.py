from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from accounts.models import Member
from accounts.permissions import HasGroupPermission
from accounts.serializers import (
    ChangePasswordSerializer,
    MemberDetailSerializer,
    MemberListSerializer,
    MemberUpdateSerializer,
)
from core.models import DefaultSetting
from core.utils import api_error, api_success
from logs.models import ActivityLog


def _log(actor, action, target=None, extra_data=None, ip=None):
    target_type = None
    target_id = None
    target_display = ''
    if target:
        target_type = ContentType.objects.get_for_model(target)
        target_id = target.pk
        target_display = str(target)
    ActivityLog.objects.create(
        actor=actor,
        actor_display=str(actor),
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


def _paginate(queryset, request, serializer_class):
    from rest_framework.pagination import PageNumberPagination
    paginator = PageNumberPagination()
    paginator.page_size = 10
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(serializer_class(page, many=True).data)


def _is_admin(user):
    return user.is_superuser or (
        user.group and user.group.permissions.filter(codename='can_manage_permissions').exists()
    )


class MemberListView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    def get(self, request):
        qs = Member.objects.select_related('group').order_by('-created_at')

        group_id = request.query_params.get('group')
        if group_id:
            qs = qs.filter(group__id=group_id)

        is_active = request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                full_name__icontains=search
            ) | qs.filter(
                display_name__icontains=search
            ) | qs.filter(
                email__icontains=search
            ) | qs.filter(
                phone__icontains=search
            )
            qs = qs.distinct()

        return _paginate(qs, request, MemberListSerializer)


class MemberDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        setting = DefaultSetting.objects.filter(key='member_profile_visibility').first()
        visibility = setting.value if setting else 'members_only'

        if visibility == 'members_only' and not request.user.is_authenticated:
            return api_error('Authentication required.', status_code=401)

        if visibility == 'group_based':
            if not request.user.is_authenticated:
                return api_error('Authentication required.', status_code=401)
            if not request.user.is_superuser:
                if not request.user.group or not request.user.group.permissions.filter(
                    codename='can_manage_permissions'
                ).exists():
                    return api_error('Permission denied.', status_code=403)

        try:
            member = Member.objects.select_related('group').get(pk=pk)
        except Member.DoesNotExist:
            return api_error('Member not found.', status_code=404)

        is_owner = request.user.pk == member.pk
        if is_owner or _is_admin(request.user):
            return api_success(MemberDetailSerializer(member).data)
        return api_success(MemberListSerializer(member).data)


class MemberUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            member = Member.objects.get(pk=pk)
        except Member.DoesNotExist:
            return api_error('Member not found.', status_code=404)

        is_owner = request.user.pk == member.pk
        if not is_owner and not _is_admin(request.user):
            return api_error('Permission denied.', status_code=403)

        before = {
            'full_name': member.full_name,
            'display_name': member.display_name,
            'email': member.email,
            'phone': member.phone,
        }

        serializer = MemberUpdateSerializer(member, data=request.data, partial=True)
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)
        serializer.save()
        member.refresh_from_db()

        after = {
            'full_name': member.full_name,
            'display_name': member.display_name,
            'email': member.email,
            'phone': member.phone,
        }
        _log(request.user, 'member_updated', target=member,
             extra_data={'before': before, 'after': after}, ip=_get_ip(request))
        return api_success(MemberDetailSerializer(member).data, message='Member updated.')


class MemberChangeGroupView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    @transaction.atomic
    def patch(self, request, pk):
        try:
            member = Member.objects.get(pk=pk)
        except Member.DoesNotExist:
            return api_error('Member not found.', status_code=404)

        if member.is_superuser:
            return api_error('Cannot change superuser group.', status_code=403)

        from accounts.models import AccessGroup
        group_id = request.data.get('group_id')
        if not group_id:
            return api_error('group_id is required.', errors={'group_id': ['This field is required.']})

        try:
            new_group = AccessGroup.objects.get(pk=group_id)
        except AccessGroup.DoesNotExist:
            return api_error('Group not found.', status_code=404)

        old_group = str(member.group) if member.group else None
        member.group = new_group
        member.save(update_fields=['group'])

        _log(request.user, 'member_group_changed', target=member,
             extra_data={'old_group': old_group, 'new_group': str(new_group)},
             ip=_get_ip(request))
        return api_success(MemberDetailSerializer(member).data, message='Group updated.')


class MemberToggleActiveView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    def patch(self, request, pk):
        try:
            member = Member.objects.get(pk=pk)
        except Member.DoesNotExist:
            return api_error('Member not found.', status_code=404)

        if member.is_superuser:
            return api_error('Cannot deactivate superuser.', status_code=403)

        member.is_active = not member.is_active
        member.save(update_fields=['is_active'])

        action = 'member_activated' if member.is_active else 'member_deactivated'
        _log(request.user, action, target=member, ip=_get_ip(request))
        status_label = 'activated' if member.is_active else 'deactivated'
        return api_success(MemberListSerializer(member).data, message=f'Member {status_label}.')


class MemberDeleteView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_delete_member')]

    def delete(self, request, pk):
        try:
            member = Member.objects.get(pk=pk)
        except Member.DoesNotExist:
            return api_error('Member not found.', status_code=404)

        if member.is_superuser:
            return api_error('Cannot delete superuser.', status_code=403)

        # Snapshot display before deletion (signal also logs, but we log here for the actor)
        actor_display = str(request.user)
        target_display = str(member)
        ActivityLog.objects.create(
            actor=request.user,
            actor_display=actor_display,
            action='member_deleted',
            target_display=target_display,
            ip_address=_get_ip(request),
        )
        member.delete()  # core/signals.py on_member_delete fires here
        return api_success(message='Member deleted.')


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            member = Member.objects.get(pk=pk)
        except Member.DoesNotExist:
            return api_error('Member not found.', status_code=404)

        if member.is_superuser:
            return api_error('Cannot change superuser password via API.', status_code=403)

        is_owner = request.user.pk == member.pk
        is_password_admin = request.user.is_superuser or (
            request.user.group and
            request.user.group.permissions.filter(codename='can_change_any_password').exists()
        )

        if not is_owner and not is_password_admin:
            return api_error('Permission denied.', status_code=403)

        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)

        if is_owner and not is_password_admin:
            old_password = serializer.validated_data.get('old_password', '')
            if not old_password:
                return api_error('Current password is required.',
                                 errors={'old_password': ['This field is required.']})
            if not member.check_password(old_password):
                return api_error('Current password is incorrect.', status_code=400)

        member.set_password(serializer.validated_data['new_password'])
        member.save(update_fields=['password'])
        _log(request.user, 'password_changed', target=member, ip=_get_ip(request))
        return api_success(message='Password changed successfully.')
