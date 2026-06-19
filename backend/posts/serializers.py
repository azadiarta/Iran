from rest_framework import serializers

from core.serializers import RelativeImageField
from posts.models import Comment, Post, PostImage


class PostImageSerializer(serializers.ModelSerializer):
    image = RelativeImageField()

    class Meta:
        model = PostImage
        fields = ['id', 'image', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at']


class PostAuthorSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    full_name = serializers.CharField(read_only=True)


class PostSerializer(serializers.ModelSerializer):
    author = PostAuthorSerializer(read_only=True)
    images = PostImageSerializer(many=True, read_only=True)

    class Meta:
        model = Post
        fields = ['id', 'author', 'title', 'body', 'images', 'created_at', 'updated_at']
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']


class PostCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ['title', 'body']

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)


class PostUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ['title', 'body']
        extra_kwargs = {
            'title': {'required': False},
            'body':  {'required': False},
        }


# Admin-only — includes the raw id and member_number, which must never be
# exposed publicly. Only used by CommentAdminDetailSerializer (gated by
# can_approve_comments), never by the public CommentSerializer below.
class CommentAuthorSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    full_name = serializers.CharField(read_only=True)
    member_number = serializers.IntegerField(read_only=True)


class CommentSerializer(serializers.ModelSerializer):
    author_label = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'author_label', 'guest_name', 'text', 'rating', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']

    def get_author_label(self, obj):
        if obj.author:
            return obj.author.display_name or obj.author.full_name
        return obj.guest_name or 'Guest'


class CommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ['guest_name', 'text', 'rating']

    def validate(self, data):
        request = self.context.get('request')
        is_authenticated = request and request.user and request.user.is_authenticated
        if not is_authenticated and not data.get('guest_name'):
            raise serializers.ValidationError({'guest_name': 'Guest name is required.'})
        return data

    def validate_rating(self, value):
        if value is None or not (1 <= value <= 5):
            raise serializers.ValidationError('A rating between 1 and 5 is required.')
        return value

    def create(self, validated_data):
        request = self.context['request']
        if request.user and request.user.is_authenticated:
            validated_data['author'] = request.user
        validated_data['status'] = Comment.Status.PENDING
        validated_data['content_type'] = self.context['content_type']
        validated_data['object_id'] = self.context['object_id']
        return super().create(validated_data)


class CommentStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ['status']

    def validate_status(self, value):
        allowed = [Comment.Status.APPROVED, Comment.Status.REJECTED]
        if value not in allowed:
            raise serializers.ValidationError('Status must be approved or rejected.')
        return value


class CommentAdminDetailSerializer(serializers.ModelSerializer):
    author = CommentAuthorSerializer(read_only=True)
    author_label = serializers.SerializerMethodField()
    target_type = serializers.SerializerMethodField()
    target_label = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            'id', 'tracking_code', 'author', 'author_label', 'guest_name', 'text', 'rating',
            'status', 'rejection_reason', 'target_type', 'target_label',
            'created_at', 'updated_at',
        ]

    def get_author_label(self, obj):
        if obj.author:
            return obj.author.display_name or obj.author.full_name
        return obj.guest_name or 'Guest'

    def get_target_type(self, obj):
        return obj.content_type.model

    def get_target_label(self, obj):
        target = obj.content_object
        if target is None:
            return None
        if obj.content_type.model == 'post':
            return target.title
        return target.short_reason


class CommentAdminEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ['text', 'rating', 'status', 'rejection_reason']

    def validate_rating(self, value):
        if value is not None and not (1 <= value <= 5):
            raise serializers.ValidationError('Rating must be between 1 and 5.')
        return value


class CommentOwnerEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ['text', 'rating']

    def validate_rating(self, value):
        if value is None or not (1 <= value <= 5):
            raise serializers.ValidationError('A rating between 1 and 5 is required.')
        return value

    def update(self, instance, validated_data):
        validated_data['status'] = Comment.Status.PENDING
        validated_data['rejection_reason'] = ''
        return super().update(instance, validated_data)


class MyCommentSerializer(serializers.ModelSerializer):
    target_type = serializers.SerializerMethodField()
    target_label = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            'id', 'text', 'rating', 'status', 'rejection_reason',
            'target_type', 'target_label', 'created_at',
        ]

    def get_target_type(self, obj):
        return obj.content_type.model

    def get_target_label(self, obj):
        target = obj.content_object
        if target is None:
            return None
        if obj.content_type.model == 'post':
            return target.title
        return target.short_reason
