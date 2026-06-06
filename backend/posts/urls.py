from django.urls import path

from posts.views import (
    CommentApproveView,
    CommentCreateView,
    CommentDeleteView,
    CommentListView,
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

    # Comment actions (approve/delete — target-agnostic)
    path('comments/<uuid:pk>/approve/',     CommentApproveView.as_view(),   name='comment-approve'),
    path('comments/<uuid:pk>/delete/',      CommentDeleteView.as_view(),    name='comment-delete'),
]
