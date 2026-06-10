from django.contrib.contenttypes.models import ContentType
from django.db import models
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from accounts.permissions import HasGroupPermission
from core.models import DefaultSetting
from core.utils import api_error, api_success
from fund.models import Expense
from logs.models import ActivityLog
from posts.models import Comment, Post, PostImage
from posts.serializers import (
    CommentCreateSerializer,
    CommentSerializer,
    PostCreateSerializer,
    PostImageSerializer,
    PostSerializer,
    PostUpdateSerializer,
)


def _log(actor, action, target=None, extra_data=None, ip=None):
    actor_display = str(actor) if (actor and actor.is_authenticated) else 'guest'
    target_type = None
    target_id = None
    target_display = ''
    if target:
        target_type = ContentType.objects.get_for_model(target)
        target_id = target.pk
        target_display = str(target)
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


def _paginate(queryset, request, serializer_class):
    from rest_framework.pagination import PageNumberPagination
    paginator = PageNumberPagination()
    paginator.page_size = 10
    page = paginator.paginate_queryset(queryset, request)
    serializer = serializer_class(page, many=True, context={'request': request})
    return paginator.get_paginated_response(serializer.data)


def _post_visible(request):
    setting = DefaultSetting.objects.filter(key='post_list_visibility').first()
    visibility = setting.value if setting else 'members_only'

    if visibility == 'all':
        return True, None
    if visibility == 'members_only':
        if not request.user or not request.user.is_authenticated:
            return False, api_error('Authentication required.', status_code=401)
        return True, None
    if visibility == 'group_based':
        if not request.user or not request.user.is_authenticated:
            return False, api_error('Authentication required.', status_code=401)
        if request.user.is_superuser:
            return True, None
        if not request.user.group:
            return False, api_error('Permission denied.', status_code=403)
        if not request.user.group.permissions.filter(codename='can_view_posts').exists():
            return False, api_error('Permission denied.', status_code=403)
        return True, None
    return True, None


def _can_modify_post(request, post):
    if request.user.is_superuser:
        return True
    if post.author and post.author == request.user:
        return True
    if request.user.group and request.user.group.permissions.filter(codename='can_manage_permissions').exists():
        return True
    return False


# ─── Post ─────────────────────────────────────────────────────────────────────

class PostListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        visible, err = _post_visible(request)
        if not visible:
            return err
        qs = Post.objects.prefetch_related('images').select_related('author').order_by('-created_at')
        return _paginate(qs, request, PostSerializer)


class PostDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        visible, err = _post_visible(request)
        if not visible:
            return err
        try:
            post = Post.objects.prefetch_related('images').select_related('author').get(pk=pk)
        except Post.DoesNotExist:
            return api_error('Post not found.', status_code=404)

        comments = Comment.objects.select_related('author').filter(
            content_type=ContentType.objects.get_for_model(Post),
            object_id=pk,
            is_approved=True,
        ).order_by('created_at')

        return api_success({
            'post': PostSerializer(post, context={'request': request}).data,
            'comments': CommentSerializer(comments, many=True).data,
        })


class PostCreateView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_post')]
    parser_classes = [MultiPartParser, JSONParser]

    def post(self, request):
        serializer = PostCreateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)

        setting = DefaultSetting.objects.filter(key='max_receipt_image_size_mb').first()
        max_mb = float(setting.value) if setting else 5.0
        images = request.FILES.getlist('images')
        for img in images:
            if img.size > max_mb * 1024 * 1024:
                return api_error(f'Image "{img.name}" exceeds {max_mb}MB limit.')

        post = serializer.save()
        for img in images:
            PostImage.objects.create(post=post, image=img)

        _log(request.user, 'post_created', target=post, ip=_get_ip(request))
        return api_success(PostSerializer(post, context={'request': request}).data, message='Post created.', status_code=201)


class PostUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return api_error('Post not found.', status_code=404)

        if not _can_modify_post(request, post):
            return api_error('Permission denied.', status_code=403)

        before = {'title': post.title, 'body': post.body}
        serializer = PostUpdateSerializer(post, data=request.data, partial=True)
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)
        serializer.save()
        after = {'title': post.title, 'body': post.body}

        _log(request.user, 'post_updated', target=post,
             extra_data={'before': before, 'after': after}, ip=_get_ip(request))
        return api_success(PostSerializer(post, context={'request': request}).data, message='Post updated.')


class PostDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return api_error('Post not found.', status_code=404)

        if not _can_modify_post(request, post):
            return api_error('Permission denied.', status_code=403)

        _log(request.user, 'post_deleted', target=post, ip=_get_ip(request))
        post.delete()  # signals handle comment cascade + system log
        return api_success(message='Post deleted.')


# ─── PostImage ────────────────────────────────────────────────────────────────

class PostImageUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request, pk):
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return api_error('Post not found.', status_code=404)

        if not _can_modify_post(request, post):
            return api_error('Permission denied.', status_code=403)

        setting = DefaultSetting.objects.filter(key='max_receipt_image_size_mb').first()
        max_mb = float(setting.value) if setting else 5.0

        images = request.FILES.getlist('images')
        for img in images:
            if img.size > max_mb * 1024 * 1024:
                return api_error(f'Image "{img.name}" exceeds {max_mb}MB limit.')

        created = []
        for img in images:
            pi = PostImage.objects.create(post=post, image=img)
            created.append(pi)

        _log(request.user, 'post_image_uploaded', target=post, ip=_get_ip(request))
        return api_success(PostImageSerializer(created, many=True, context={'request': request}).data, status_code=201)


class PostImageDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, image_id):
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return api_error('Post not found.', status_code=404)

        if not _can_modify_post(request, post):
            return api_error('Permission denied.', status_code=403)

        try:
            image = PostImage.objects.get(pk=image_id, post=post)
        except PostImage.DoesNotExist:
            return api_error('Image not found.', status_code=404)

        _log(request.user, 'post_image_deleted', target=post, ip=_get_ip(request))
        image.delete()
        return api_success(message='Image deleted.')


# ─── Comments ─────────────────────────────────────────────────────────────────

def _resolve_comment_target(target_type, pk):
    if target_type == 'post':
        try:
            obj = Post.objects.get(pk=pk)
            ct = ContentType.objects.get_for_model(Post)
        except Post.DoesNotExist:
            return None, None, api_error('Post not found.', status_code=404)
    elif target_type == 'expense':
        try:
            obj = Expense.objects.get(pk=pk)
            ct = ContentType.objects.get_for_model(Expense)
        except Expense.DoesNotExist:
            return None, None, api_error('Expense not found.', status_code=404)
    else:
        return None, None, api_error('Invalid target type.', status_code=400)
    return ct, obj.pk, None


class CommentGlobalListView(APIView):
    """GET /api/posts/comments/ — paginated, filterable global comment list (admin moderation)."""
    permission_classes = [IsAuthenticated, HasGroupPermission('can_approve_comments')]

    def get(self, request):
        qs = Comment.objects.select_related('author').order_by('-created_at')

        is_approved = request.query_params.get('is_approved')
        if is_approved is not None:
            qs = qs.filter(is_approved=is_approved.lower() in ('true', '1'))

        target_type = request.query_params.get('target_type')
        if target_type in ('post', 'expense'):
            model = Post if target_type == 'post' else Expense
            qs = qs.filter(content_type=ContentType.objects.get_for_model(model))

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                models.Q(text__icontains=search)
                | models.Q(guest_name__icontains=search)
                | models.Q(author__full_name__icontains=search)
                | models.Q(author__display_name__icontains=search)
            )

        return _paginate(qs, request, CommentSerializer)


class CommentListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, target_type, pk):
        ct, object_id, err = _resolve_comment_target(target_type, pk)
        if err:
            return err
        comments = Comment.objects.filter(
            content_type=ct, object_id=object_id, is_approved=True,
        ).select_related('author').order_by('created_at')
        return api_success(CommentSerializer(comments, many=True).data)


class CommentCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, target_type, pk):
        ct, object_id, err = _resolve_comment_target(target_type, pk)
        if err:
            return err

        serializer = CommentCreateSerializer(
            data=request.data,
            context={'request': request, 'content_type': ct, 'object_id': object_id},
        )
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)
        comment = serializer.save()

        actor = request.user if request.user.is_authenticated else None
        _log(actor, 'comment_submitted', target=comment, ip=_get_ip(request))
        return api_success(CommentSerializer(comment).data, message='Comment submitted for approval.', status_code=201)


class CommentApproveView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_approve_comments')]

    def patch(self, request, pk):
        try:
            comment = Comment.objects.get(pk=pk)
        except Comment.DoesNotExist:
            return api_error('Comment not found.', status_code=404)

        comment.is_approved = True
        comment.save(update_fields=['is_approved'])
        _log(request.user, 'comment_approved', target=comment, ip=_get_ip(request))
        return api_success(CommentSerializer(comment).data, message='Comment approved.')


class CommentDeleteView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    def delete(self, request, pk):
        try:
            comment = Comment.objects.get(pk=pk)
        except Comment.DoesNotExist:
            return api_error('Comment not found.', status_code=404)

        _log(request.user, 'comment_deleted', target=comment, ip=_get_ip(request))
        comment.delete()
        return api_success(message='Comment deleted.')
