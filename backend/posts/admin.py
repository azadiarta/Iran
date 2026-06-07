import json
import logging

from django.contrib import admin
from django.contrib.contenttypes.admin import GenericTabularInline
from django.contrib.contenttypes.models import ContentType
from django.utils.html import mark_safe
from django.utils.translation import gettext_lazy as _

from logs.models import ActivityLog
from posts.models import Comment, Post, PostImage

logger = logging.getLogger(__name__)


def _get_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    return forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')


class PostImageInline(admin.TabularInline):
    model = PostImage
    fields = ['image', 'image_preview', 'uploaded_at']
    readonly_fields = ['image_preview', 'uploaded_at']
    extra = 1

    def image_preview(self, obj):
        if obj.pk and obj.image:
            return mark_safe(
                f'<img src="{obj.image.url}" style="max-height:80px;max-width:120px;border-radius:3px;" />'
            )
        return '—'
    image_preview.short_description = 'Preview'


class PostCommentInline(GenericTabularInline):
    model = Comment
    fields = ['author', 'guest_name', 'text', 'rating', 'is_approved', 'created_at']
    readonly_fields = ['author', 'guest_name', 'text', 'rating', 'is_approved', 'created_at']
    extra = 0
    verbose_name_plural = 'Approved Comments'

    def get_queryset(self, request):
        return super().get_queryset(request).filter(is_approved=True).order_by('-created_at')

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['title', 'author', 'comment_count', 'created_at', 'updated_at']
    list_filter = ['created_at']
    search_fields = ['title', 'body']
    readonly_fields = ['id', 'created_at', 'updated_at']
    inlines = [PostImageInline, PostCommentInline]

    fieldsets = [
        (None,      {'fields': ['author', 'title', 'body']}),
        (_('Meta'), {'fields': ['id', 'created_at', 'updated_at'], 'classes': ['collapse']}),
    ]

    def comment_count(self, obj):
        ct = ContentType.objects.get_for_model(obj)
        return Comment.objects.filter(content_type=ct, object_id=obj.pk, is_approved=True).count()
    comment_count.short_description = 'Approved Comments'


@admin.register(PostImage)
class PostImageAdmin(admin.ModelAdmin):
    list_display = ['post_title', 'image_preview', 'uploaded_at']
    readonly_fields = ['uploaded_at', 'image_preview']

    def post_title(self, obj):
        return obj.post.title
    post_title.short_description = 'Post'

    def image_preview(self, obj):
        if obj.image:
            return mark_safe(
                f'<img src="{obj.image.url}" style="max-height:60px;max-width:90px;border-radius:3px;" />'
            )
        return '—'
    image_preview.short_description = 'Preview'


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['author_display', 'text_preview', 'target', 'rating', 'is_approved', 'created_at']
    list_filter = ['is_approved', 'created_at']
    search_fields = ['text', 'guest_name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    actions = ['approve_comments', 'reject_comments']

    fieldsets = [
        (_('Author'),   {'fields': ['author', 'guest_name']}),
        (_('Content'),  {'fields': ['content_type', 'object_id', 'text', 'rating', 'is_approved']}),
        (_('Meta'),     {'fields': ['id', 'created_at', 'updated_at'], 'classes': ['collapse']}),
    ]

    def author_display(self, obj):
        if obj.author:
            return str(obj.author)
        return f'Guest: {obj.guest_name}' if obj.guest_name else 'Guest'
    author_display.short_description = 'Author'

    def text_preview(self, obj):
        return obj.text[:50] + ('…' if len(obj.text) > 50 else '')
    text_preview.short_description = 'Comment'

    def target(self, obj):
        try:
            label = str(obj.content_object)[:60] if obj.content_object else str(obj.object_id)
            return f'{obj.content_type} — {label}'
        except Exception:
            logger.exception('Failed to render comment target for comment %s', obj.pk)
            return f'{obj.content_type} #{obj.object_id}'
    target.short_description = 'Target'

    @admin.action(description='Approve selected comments')
    def approve_comments(self, request, queryset):
        updated = queryset.update(is_approved=True)
        for obj in queryset:
            ActivityLog.objects.create(
                actor=request.user,
                actor_display=str(request.user),
                action='comment_approved_via_admin',
                target_type=ContentType.objects.get_for_model(obj),
                target_id=obj.pk,
                target_display=str(obj),
                ip_address=_get_ip(request),
            )
        self.message_user(request, f'{updated} comment(s) approved.')

    @admin.action(description='Reject selected comments')
    def reject_comments(self, request, queryset):
        updated = queryset.update(is_approved=False)
        for obj in queryset:
            ActivityLog.objects.create(
                actor=request.user,
                actor_display=str(request.user),
                action='comment_rejected_via_admin',
                target_type=ContentType.objects.get_for_model(obj),
                target_id=obj.pk,
                target_display=str(obj),
                ip_address=_get_ip(request),
            )
        self.message_user(request, f'{updated} comment(s) rejected.')
