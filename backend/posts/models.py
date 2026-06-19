import uuid
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core.tracking_codes import generate_tracking_code


class Post(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(
        'accounts.Member', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='posts',
    )
    title = models.CharField(max_length=150)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class PostImage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='posts/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Image → {self.post.title}'


# Generic FK targets Post or Expense.
# ALL comments (member AND guest) require approval — status defaults to pending.
# Editing a comment (CommentUpdateView) resets status back to pending.

class Comment(models.Model):
    class Status(models.TextChoices):
        PENDING  = 'pending',  'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # System-assigned lookup code (never user-supplied), admin-panel-only —
    # see save()/core/tracking_codes.py. Format matches Contribution and
    # ContactMessage's tracking_code (letter 'C' for Comment).
    tracking_code = models.CharField(max_length=20, unique=True, editable=False, blank=True)
    author = models.ForeignKey(
        'accounts.Member', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='comments',
    )
    guest_name = models.CharField(max_length=50, blank=True)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField()
    content_object = GenericForeignKey('content_type', 'object_id')
    text = models.TextField()
    rating = models.IntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['content_type', 'object_id'])]

    def save(self, *args, **kwargs):
        if not self.tracking_code:
            member_number = self.author.member_number if self.author_id else None
            self.tracking_code = generate_tracking_code(Comment, 'C', member_number)
        super().save(*args, **kwargs)

    def __str__(self):
        name = (
            self.author.display_name or self.author.full_name
            if self.author
            else (self.guest_name or 'Guest')
        )
        return f'{name} on {self.content_type} #{self.object_id}'
