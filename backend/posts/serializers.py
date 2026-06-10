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


class CommentAuthorSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    full_name = serializers.CharField(read_only=True)


class CommentSerializer(serializers.ModelSerializer):
    author = CommentAuthorSerializer(read_only=True)
    author_label = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'author', 'author_label', 'guest_name', 'text', 'rating', 'is_approved', 'created_at']
        read_only_fields = ['id', 'is_approved', 'created_at']

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
        if value is not None and not (1 <= value <= 10):
            raise serializers.ValidationError('Rating must be between 1 and 10.')
        return value

    def create(self, validated_data):
        request = self.context['request']
        if request.user and request.user.is_authenticated:
            validated_data['author'] = request.user
        validated_data['is_approved'] = False
        validated_data['content_type'] = self.context['content_type']
        validated_data['object_id'] = self.context['object_id']
        return super().create(validated_data)
