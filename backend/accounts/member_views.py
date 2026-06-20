from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models import Q
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from accounts.models import Member
from accounts.permissions import HasGroupPermission
from accounts.serializers import (
    ChangePasswordSerializer,
    MemberCreateSerializer,
    MemberDetailSerializer,
    MemberListSerializer,
    MemberUpdateSerializer,
)
from core.log_utils import actor_display_for, target_display_for
from core.models import DefaultSetting
from core.pagination import paginate
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


def _is_admin(user):
    return user.is_superuser or (
        user.group and user.group.permissions.filter(codename='can_manage_permissions').exists()
    )


def _can_view_member_details(user):
    """can_manage_permissions OR the narrower, view-only can_view_member_details."""
    return user.is_superuser or (
        user.group and user.group.permissions.filter(
            codename__in=['can_manage_permissions', 'can_view_member_details']
        ).exists()
    )


class MemberPublicCountView(APIView):
    """Active member count for the public homepage stats bar — no member detail leaked."""
    permission_classes = [AllowAny]

    def get(self, request):
        return api_success({'count': Member.objects.filter(is_active=True).count()})


class MemberListView(APIView):
    permission_classes = [
        IsAuthenticated,
        HasGroupPermission('can_manage_permissions') | HasGroupPermission('can_view_member_details'),
    ]

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
            q = (
                Q(full_name__icontains=search)
                | Q(display_name__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
            )
            if search.isdigit():
                q |= Q(member_number=int(search))
            qs = qs.filter(q).distinct()

        return paginate(qs, request, MemberListSerializer)


class MemberCreateView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    def post(self, request):
        serializer = MemberCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)
        member = serializer.save()
        _log(request.user, 'member_created_via_admin', target=member, ip=_get_ip(request))
        return api_success(MemberDetailSerializer(member).data, message='Member created.', status_code=201)


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
        if is_owner or _can_view_member_details(request.user):
            return api_success(MemberDetailSerializer(member).data)
        return api_success(MemberListSerializer(member).data)


class MemberFullProfileView(APIView):
    """Aggregated, read-only view of everything tied to one member: their
    comments, contributions, contact messages and recent activity — gated on
    the narrower can_view_member_details permission (or full can_manage_permissions)."""
    permission_classes = [
        IsAuthenticated,
        HasGroupPermission('can_manage_permissions') | HasGroupPermission('can_view_member_details'),
    ]

    def get(self, request, pk):
        try:
            member = Member.objects.select_related('group').get(pk=pk)
        except Member.DoesNotExist:
            return api_error('Member not found.', status_code=404)

        from core.models import ContactMessage
        from core.serializers import ContactMessageSerializer
        from fund.models import Contribution
        from fund.serializers import ContributionAdminDetailSerializer
        from logs.serializers import ActivityLogSerializer
        from posts.models import Comment
        from posts.serializers import CommentAdminDetailSerializer

        comments = Comment.objects.filter(author_id=member.pk).select_related('content_type').order_by('-created_at')
        contributions = Contribution.objects.filter(contributor_id=member.pk).order_by('-created_at')
        contact_messages = ContactMessage.objects.filter(sender_id=member.pk).select_related('handled_by').order_by('-created_at')
        activity_logs = ActivityLog.objects.filter(actor_id=member.pk).order_by('-created_at')[:50]

        return api_success({
            'member': MemberDetailSerializer(member).data,
            'comments': CommentAdminDetailSerializer(comments, many=True).data,
            'contributions': ContributionAdminDetailSerializer(contributions, many=True).data,
            'contact_messages': ContactMessageSerializer(contact_messages, many=True).data,
            'activity_logs': ActivityLogSerializer(activity_logs, many=True).data,
        })


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

        if member.is_superuser and not is_owner:
            return api_error('Cannot edit superuser profile.', status_code=403)

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

        previous_state = member.is_active
        member.is_active = not member.is_active

        if member.is_active:
            member.deactivation_reason = ''
            member.deactivated_by = None
            update_fields = ['is_active', 'deactivation_reason', 'deactivated_by']
        else:
            member.deactivation_reason = (request.data.get('reason') or '').strip()
            member.deactivated_by = request.user
            update_fields = ['is_active', 'deactivation_reason', 'deactivated_by']

        member.save(update_fields=update_fields)

        action = 'member_activated' if member.is_active else 'member_deactivated'
        _log(request.user, action, target=member, ip=_get_ip(request), extra_data={
            'member_id': str(member.pk),
            'member_name': str(member),
            'previous_state': previous_state,
            'reason': member.deactivation_reason,
        })
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
        target_display = target_display_for(member)
        ActivityLog.objects.create(
            actor=request.user,
            actor_display=actor_display_for(request.user),
            action='member_deleted',
            target_display=target_display,
            ip_address=_get_ip(request),
            extra_data={
                'member_id': str(member.pk),
                'member_name': target_display,
                'email': member.email,
                'phone': member.phone,
                'group': str(member.group) if member.group else None,
                'previous_state': member.is_active,
            },
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

        is_owner = request.user.pk == member.pk
        is_password_admin = request.user.is_superuser or (
            request.user.group and
            request.user.group.permissions.filter(codename='can_change_any_password').exists()
        )

        if member.is_superuser and not is_owner:
            return api_error('Cannot change superuser password.', status_code=403)

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
