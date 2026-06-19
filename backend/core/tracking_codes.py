import random


def generate_tracking_code(model_cls, letter, member_number=None):
    """
    System-assigned per-submission code, admin-panel-only (never shown to other
    members): 5-digit member number (00000 for guests) + a fixed letter
    identifying the submission type (e.g. 'C'omment, 'F'und contribution,
    'M'essage) + a random 3-digit suffix, retried for uniqueness against
    model_cls's tracking_code column. Mirrors Member._generate_member_number()'s
    random-retry-for-uniqueness approach.
    """
    prefix = f'{member_number:05d}' if member_number else '00000'
    for _ in range(20):
        candidate = f'{prefix}{letter}{random.randint(0, 999):03d}'
        if not model_cls.objects.filter(tracking_code=candidate).exists():
            return candidate
    raise RuntimeError(f'Could not generate a unique tracking code for {model_cls.__name__}.')
