def actor_display_for(actor):
    """
    Precise, identifiable ActivityLog actor label: display name + member_number
    (e.g. 'Sara (#41822)'), so no admin action can be attributed to an ambiguous
    name. Falls back to 'guest' when there is no authenticated actor.
    """
    if not actor:
        return 'guest'
    return f'{actor.display_name or actor.full_name} (#{actor.member_number})'


def target_display_for(target):
    """
    Precise, identifiable ActivityLog target label. Prefers the target's own
    tracking_code (Comment/Contribution/ContactMessage) when present, falls
    back to member_number when the target is a Member, else just str(target).
    """
    if target is None:
        return ''
    tracking_code = getattr(target, 'tracking_code', None)
    if tracking_code:
        return f'{target} [{tracking_code}]'
    member_number = getattr(target, 'member_number', None)
    if member_number:
        return f'{target} (#{member_number})'
    return str(target)
