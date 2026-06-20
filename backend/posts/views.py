from django.contrib.contenttypes.models import ContentType
from django.db import models
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from rest_framework.exceptions import ValidationError as DRFValidationError

from accounts.permissions import HasGroupPermission
from core.log_utils import actor_display_for, target_display_for
from core.models import DefaultSetting
from core.pagination import paginate
from core.utils import api_error, api_success
from core.validators import safe_filter, validate_image_file
from fund.models import Expense
from logs.models import ActivityLog
from posts.models import Comment, Post, PostImage
from posts.serializers import (
    CommentAdminDetailSerializer,
    CommentAdminEditSerializer,
    CommentCreateSerializer,
    CommentOwnerEditSerializer,
    CommentSerializer,
    CommentStatusSerializer,
    MyCommentSerializer,
    PostAdminDetailSerializer,
    PostCreateSerializer,
    PostImageSerializer,
    PostSerializer,
    PostUpdateSerializer,
)


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

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(models.Q(title__icontains=search) | models.Q(body__icontains=search))

        return paginate(qs, request, PostSerializer)


class PostAdminListView(APIView):
    """GET /api/posts/admin/ — paginated, filterable admin post list (search/author/date range)."""
    permission_classes = [IsAuthenticated, HasGroupPermission('can_post')]

    def get(self, request):
        qs = Post.objects.prefetch_related('images').select_related('author').order_by('-created_at')

        author_id = request.query_params.get('author')
        if author_id:
            qs = safe_filter(qs, author__id=author_id)

        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            qs = safe_filter(qs, created_at__date__gte=date_from)
        if date_to:
            qs = safe_filter(qs, created_at__date__lte=date_to)

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                models.Q(title__icontains=search)
                | models.Q(body__icontains=search)
                | models.Q(author__full_name__icontains=search)
                | models.Q(author__display_name__icontains=search)
                | models.Q(tracking_code__icontains=search)
            )

        return paginate(qs, request, PostAdminDetailSerializer)


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
            status=Comment.Status.APPROVED,
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
            try:
                validate_image_file(img, max_mb)
            except DRFValidationError as exc:
                detail = exc.detail[0] if isinstance(exc.detail, list) else exc.detail
                return api_error(f'Image "{img.name}": {detail}')

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

        _log(request.user, 'post_deleted', target=post, ip=_get_ip(request), extra_data={
            'title': post.title,
            'body': post.body,
            'author': str(post.author) if post.author else None,
        })
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
            try:
                validate_image_file(img, max_mb)
            except DRFValidationError as exc:
                detail = exc.detail[0] if isinstance(exc.detail, list) else exc.detail
                return api_error(f'Image "{img.name}": {detail}')

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

        status_filter = request.query_params.get('status')
        if status_filter in (Comment.Status.PENDING, Comment.Status.APPROVED, Comment.Status.REJECTED):
            qs = qs.filter(status=status_filter)

        target_type = request.query_params.get('target_type')
        if target_type in ('post', 'expense'):
            model = Post if target_type == 'post' else Expense
            qs = qs.filter(content_type=ContentType.objects.get_for_model(model))

        author_id = request.query_params.get('author')
        if author_id:
            qs = safe_filter(qs, author_id=author_id)

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                models.Q(text__icontains=search)
                | models.Q(guest_name__icontains=search)
                | models.Q(author__full_name__icontains=search)
                | models.Q(author__display_name__icontains=search)
                | models.Q(tracking_code__icontains=search)
            )

        return paginate(qs, request, CommentSerializer, page_size=10)


class CommentListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, target_type, pk):
        ct, object_id, err = _resolve_comment_target(target_type, pk)
        if err:
            return err
        comments = Comment.objects.filter(
            content_type=ct, object_id=object_id, status=Comment.Status.APPROVED,
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


class CommentStatusUpdateView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_approve_comments')]

    def patch(self, request, pk):
        try:
            comment = Comment.objects.get(pk=pk)
        except Comment.DoesNotExist:
            return api_error('Comment not found.', status_code=404)

        before_status = comment.status
        serializer = CommentStatusSerializer(comment, data=request.data, partial=True)
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)
        serializer.save()
        _log(
            request.user, 'comment_status_updated', target=comment,
            extra_data={'before': before_status, 'after': comment.status},
            ip=_get_ip(request),
        )
        return api_success(CommentSerializer(comment).data, message='Status updated.')


class CommentAdminDetailView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_approve_comments')]

    def get(self, request, pk):
        try:
            comment = Comment.objects.select_related('author').get(pk=pk)
        except Comment.DoesNotExist:
            return api_error('Comment not found.', status_code=404)
        return api_success(CommentAdminDetailSerializer(comment).data)


class CommentAdminEditView(APIView):
    permission_classes = [IsAuthenticated, HasGroupPermission('can_approve_comments')]

    EDITABLE_FIELDS = ['text', 'rating', 'status', 'rejection_reason']

    def patch(self, request, pk):
        try:
            comment = Comment.objects.select_related('author').get(pk=pk)
        except Comment.DoesNotExist:
            return api_error('Comment not found.', status_code=404)

        before = {field: str(getattr(comment, field)) for field in self.EDITABLE_FIELDS}

        serializer = CommentAdminEditSerializer(comment, data=request.data, partial=True)
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)
        serializer.save()

        after = {field: str(getattr(comment, field)) for field in self.EDITABLE_FIELDS}
        _log(
            request.user, 'comment_edited_by_admin', target=comment,
            extra_data={'before': before, 'after': after},
            ip=_get_ip(request),
        )
        return api_success(CommentAdminDetailSerializer(comment).data, message='Comment updated.')


class CommentUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            comment = Comment.objects.get(pk=pk)
        except Comment.DoesNotExist:
            return api_error('Comment not found.', status_code=404)

        if comment.author_id != request.user.id:
            return api_error('Permission denied.', status_code=403)

        serializer = CommentOwnerEditSerializer(comment, data=request.data, partial=True)
        if not serializer.is_valid():
            return api_error('Validation failed.', errors=serializer.errors)
        serializer.save()

        _log(request.user, 'comment_edited_by_owner', target=comment, ip=_get_ip(request))
        return api_success(CommentSerializer(comment).data, message='Comment updated and resubmitted for approval.')


class MyCommentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Comment.objects.filter(author=request.user).order_by('-created_at')
        return paginate(qs, request, MyCommentSerializer)
