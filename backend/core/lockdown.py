from core.models import DefaultSetting

# DefaultSetting keys backing the two independent lockdown toggles. Both are
# seeded by seed_initial_data.py and are never exposed via the generic
# DefaultSettingListView/DefaultSettingUpdateView (see settings_views.py) —
# they're only ever written through lockdown_views.py, which enforces the
# precedence rule between the two kinds.
SUPERUSER_ENABLED_KEY = 'superuser_lockdown_enabled'
SUPERUSER_MESSAGE_KEY = 'superuser_lockdown_message'
PERMISSION_ENABLED_KEY = 'permission_lockdown_enabled'
PERMISSION_MESSAGE_KEY = 'permission_lockdown_message'

LOCKDOWN_KEYS = (
    SUPERUSER_ENABLED_KEY, SUPERUSER_MESSAGE_KEY,
    PERMISSION_ENABLED_KEY, PERMISSION_MESSAGE_KEY,
)


def get_lockdown_state():
    """
    Returns (kind, message) where kind is one of None/'superuser'/'permission'.
    Superuser-kind lockdown always takes precedence: if both happened to be
    on, it's reported as 'superuser' (in practice this can't happen — see
    lockdown_views.py, which forcibly turns 'permission' off when 'superuser'
    is turned on).
    """
    rows = dict(DefaultSetting.objects.filter(key__in=LOCKDOWN_KEYS).values_list('key', 'value'))
    if rows.get(SUPERUSER_ENABLED_KEY) == 'true':
        return 'superuser', rows.get(SUPERUSER_MESSAGE_KEY, '')
    if rows.get(PERMISSION_ENABLED_KEY) == 'true':
        return 'permission', rows.get(PERMISSION_MESSAGE_KEY, '')
    return None, ''


def is_admin_member(user):
    """
    Mirrors frontend lib/adminNav.ts hasAdminAccess(): a member counts as
    "admin" (and is therefore exempt from a 'permission'-kind lockdown) if
    they're superuser, or their group holds any permission outside the 4
    baseline ones every regular member is granted by default.
    """
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    if not user.group:
        return False
    from accounts.models import BASELINE_GROUP_PERMISSIONS
    return user.group.permissions.exclude(codename__in=BASELINE_GROUP_PERMISSIONS).exists()
