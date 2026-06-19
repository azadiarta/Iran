from django.urls import path

from posts.views import (
    CommentAdminDetailView,
    CommentAdminEditView,
    CommentCreateView,
    CommentGlobalListView,
    CommentListView,
    CommentStatusUpdateView,
    CommentUpdateView,
    MyCommentsView,
    PostCreateView,
    PostDeleteView,
    PostDetailView,
    PostImageDeleteView,
    PostImageUploadView,
    PostListView,
    PostUpdateView,
)

urlpatterns = [
    # Posts
    path('',                                PostListView.as_view(),         name='post-list'),
    path('create/',                         PostCreateView.as_view(),       name='post-create'),
    path('<uuid:pk>/',                      PostDetailView.as_view(),       name='post-detail'),
    path('<uuid:pk>/update/',               PostUpdateView.as_view(),       name='post-update'),
    path('<uuid:pk>/delete/',               PostDeleteView.as_view(),       name='post-delete'),

    # Post images
    path('<uuid:pk>/images/',               PostImageUploadView.as_view(),  name='post-image-upload'),
    path('<uuid:pk>/images/<uuid:image_id>/delete/', PostImageDeleteView.as_view(), name='post-image-delete'),

    # Comments on posts
    path('<uuid:pk>/comments/',             CommentListView.as_view(),   kwargs={'target_type': 'post'},   name='post-comment-list'),
    path('<uuid:pk>/comments/create/',      CommentCreateView.as_view(), kwargs={'target_type': 'post'},   name='post-comment-create'),

    # Global comment list (admin moderation — target-agnostic)
    path('comments/',                       CommentGlobalListView.as_view(), name='comment-global-list'),
    path('comments/mine/',                  MyCommentsView.as_view(),        name='comment-mine'),

    # Comment actions (target-agnostic) — suffixed routes before bare <uuid:pk>/
    path('comments/<uuid:pk>/status/',      CommentStatusUpdateView.as_view(), name='comment-status'),
    path('comments/<uuid:pk>/edit/',        CommentAdminEditView.as_view(),    name='comment-admin-edit'),
    path('comments/<uuid:pk>/update/',      CommentUpdateView.as_view(),       name='comment-update'),
    path('comments/<uuid:pk>/',             CommentAdminDetailView.as_view(),  name='comment-admin-detail'),
]
