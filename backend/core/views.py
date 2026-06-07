from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from accounts.permissions import HasGroupPermission
from core.models import Permission
from core.serializers import PermissionSerializer
from core.utils import api_success


class PermissionListView(APIView):
    """GET /api/permissions/ — lists all available permission codenames."""
    permission_classes = [IsAuthenticated, HasGroupPermission('can_manage_permissions')]

    def get(self, request):
        permissions = Permission.objects.all()
        return api_success(PermissionSerializer(permissions, many=True).data)
