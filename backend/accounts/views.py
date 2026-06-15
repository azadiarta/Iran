from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.models import Member
from accounts.serializers import LoginSerializer, MemberProfileSerializer, RegisterSerializer
from logs.models import ActivityLog


def _get_client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _log(actor, actor_display, action, ip=None, extra=None):
    ActivityLog.objects.create(
        actor=actor,
        actor_display=actor_display,
        action=action,
        ip_address=ip,
        extra_data=extra,
    )


class RegisterView(APIView):
    """POST /api/auth/register/ — public"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        member = serializer.save()
        refresh = RefreshToken.for_user(member)

        _log(
            actor=member,
            actor_display=member.display_name or member.full_name,
            action='registered',
            ip=_get_client_ip(request),
        )

        return Response({
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
            'member': MemberProfileSerializer(member).data,
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """POST /api/auth/login/ — public"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        credential = serializer.validated_data['credential']
        password = serializer.validated_data['password']
        ip = _get_client_ip(request)

        member = authenticate(request, credential=credential, password=password)

        if member is None:
            # Try to identify who attempted (for logging)
            actor, display = None, credential
            try:
                lookup = {'email': credential} if '@' in credential else {'phone': credential}
                found = Member.objects.get(**lookup)
                actor, display = found, found.display_name or found.full_name
            except Member.DoesNotExist:
                pass

            _log(actor=actor, actor_display=display, action='failed_login',
                 ip=ip, extra={'credential': credential})
            return Response({'message': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(member)
        _log(actor=member, actor_display=member.display_name or member.full_name,
             action='login', ip=ip)

        return Response({
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
            'member': MemberProfileSerializer(member).data,
        })


class LogoutView(APIView):
    """POST /api/auth/logout/ — authenticated"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'error': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            RefreshToken(refresh_token).blacklist()
        except TokenError:
            return Response(
                {'error': 'Invalid or expired token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        _log(
            actor=request.user,
            actor_display=request.user.display_name or request.user.full_name,
            action='logout',
            ip=_get_client_ip(request),
        )
        return Response({'detail': 'Logged out successfully.'})


class SafeTokenRefreshSerializer(TokenRefreshSerializer):
    """
    TokenRefreshSerializer.validate() looks up the member referenced by the
    refresh token's user_id claim with a plain .get() and no error handling.
    If that member has since been deleted (e.g. by an admin), Django raises
    Member.DoesNotExist, which simplejwt does not catch -> 500 Internal
    Server Error instead of a normal 401. Convert it into an InvalidToken so
    the frontend's refresh-failure handling (logout) kicks in as expected.
    """

    def validate(self, attrs):
        try:
            return super().validate(attrs)
        except Member.DoesNotExist:
            raise InvalidToken('No account found for this token.')


class SafeTokenRefreshView(TokenRefreshView):
    serializer_class = SafeTokenRefreshSerializer


class ProfileView(APIView):
    """GET /api/auth/profile/ — authenticated"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MemberProfileSerializer(request.user).data)
