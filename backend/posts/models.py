import uuid
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


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
# ALL comments (member AND guest) require approval — is_approved=False default.

class Comment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
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
        validators=[MinValueValidator(1), MaxValueValidator(10)],
    )
    is_approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['content_type', 'object_id'])]

    def __str__(self):
        name = (
            self.author.display_name or self.author.full_name
            if self.author
            else (self.guest_name or 'Guest')
        )
        return f'{name} on {self.content_type} #{self.object_id}'
