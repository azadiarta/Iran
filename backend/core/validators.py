"""
Shared input-validation helpers used across every app's serializers.

Centralizes the rules that used to be duplicated (or missing) per-serializer:
phone/email format checks, text-length tiers, HTML stripping, and real
file-content verification for uploads. Frontend mirrors these same rules in
frontend/lib/validation.ts so invalid input is rejected before submission
AND re-checked here regardless of what the client sent.
"""
import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email as django_validate_email
from django.utils.html import strip_tags
from rest_framework import serializers as drf_serializers

try:
    from PIL import Image, UnidentifiedImageError
except ImportError:  # pragma: no cover - Pillow is a hard dependency in requirements.txt
    Image = None
    UnidentifiedImageError = Exception


# Strict format required for newly-entered phone numbers: international
# "00" prefix (never "+"), then 6-15 digits, e.g. 00447700900000.
PHONE_REGEX = re.compile(r'^00\d{6,15}$')

# Lenient phone shape accepted for existing data (login credential, or an
# update where the value didn't change): "00" or "+" prefix, 6-15 digits.
LENIENT_PHONE_REGEX = re.compile(r'^(00|\+)?\d{6,15}$')

# Generic single-line "short text" boxes (name/title/message-style fields,
# not the intentionally tighter name fields like full_name/display_name and
# not the LONG_TEXT_* textarea fields below): public-site forms cap at 50,
# the same field edited from the admin panel caps at 100.
SHORT_TEXT_PUBLIC_MAX_LENGTH = 50
SHORT_TEXT_ADMIN_MAX_LENGTH = 100
LONG_TEXT_PUBLIC_MAX_LENGTH = 250
LONG_TEXT_ADMIN_MAX_LENGTH = 550

# The model field allows Django's default 254, but real addresses never get
# remotely close to that; capping at 75 keeps the field sane everywhere it's
# entered (registration, profile edit, admin member create/edit, login).
EMAIL_MAX_LENGTH = 75

ALLOWED_IMAGE_FORMATS = {'JPEG', 'PNG'}
MAX_UPLOAD_FILENAME_LENGTH = 255


def validate_phone_format(value):
    """Strict '00'-prefixed international phone format, e.g. 00447700900000."""
    if not value:
        return value
    if not PHONE_REGEX.match(value):
        raise drf_serializers.ValidationError(
            "Phone number must start with '00' followed by the country code and number "
            "(e.g. 00447700900000)."
        )
    return value


def validate_phone_lenient(value):
    """Looser phone shape check for pre-existing/unchanged values."""
    if not value:
        return value
    if not LENIENT_PHONE_REGEX.match(value):
        raise drf_serializers.ValidationError(
            "Enter a valid phone number (e.g. 00447700900000)."
        )
    return value


def validate_email_format(value):
    if not value:
        return value
    if len(value) > EMAIL_MAX_LENGTH:
        raise drf_serializers.ValidationError(
            f"Email address must be {EMAIL_MAX_LENGTH} characters or fewer."
        )
    try:
        django_validate_email(value)
    except DjangoValidationError:
        raise drf_serializers.ValidationError("Enter a valid email address.")
    return value


def validate_phone_or_email(value):
    """Lenient check for fields that may hold either a phone or an email."""
    if not value:
        return value
    try:
        django_validate_email(value)
        if len(value) > EMAIL_MAX_LENGTH:
            raise drf_serializers.ValidationError(
                f"Email address must be {EMAIL_MAX_LENGTH} characters or fewer."
            )
        return value
    except DjangoValidationError:
        pass
    if LENIENT_PHONE_REGEX.match(value):
        return value
    raise drf_serializers.ValidationError(
        "Enter a valid email address or phone number (starting with 00, e.g. 00447700900000)."
    )


def sanitize_text(value):
    """Strip HTML tags and surrounding whitespace from user-submitted free text."""
    if value is None:
        return value
    return strip_tags(value).strip()


def validate_max_length(value, max_length):
    if value and len(value) > max_length:
        raise drf_serializers.ValidationError(
            f"Must be {max_length} characters or fewer."
        )
    return value


def sanitize_and_limit(value, max_length):
    """Common pattern: strip HTML, then enforce a length cap."""
    value = sanitize_text(value)
    return validate_max_length(value, max_length)


def validate_image_content(file_obj):
    """Verify the uploaded file is actually a real image, not just named like one."""
    try:
        file_obj.seek(0)
        img = Image.open(file_obj)
        img.verify()
        fmt = img.format
    except Exception:
        raise drf_serializers.ValidationError("The uploaded file is not a valid image.")
    finally:
        try:
            file_obj.seek(0)
        except Exception:
            pass
    if fmt not in ALLOWED_IMAGE_FORMATS:
        raise drf_serializers.ValidationError("Only JPEG and PNG images are allowed.")
    return file_obj


def validate_pdf_content(file_obj):
    """Verify the uploaded file actually starts with a PDF magic header."""
    file_obj.seek(0)
    header = file_obj.read(5)
    file_obj.seek(0)
    if header != b'%PDF-':
        raise drf_serializers.ValidationError("The uploaded file is not a valid PDF.")
    return file_obj


def _validate_upload_basics(file_obj, max_size_mb):
    if len(file_obj.name) > MAX_UPLOAD_FILENAME_LENGTH:
        raise drf_serializers.ValidationError("File name is too long.")
    max_bytes = max_size_mb * 1024 * 1024
    if file_obj.size > max_bytes:
        raise drf_serializers.ValidationError(f"File size must not exceed {max_size_mb}MB.")
    if file_obj.size == 0:
        raise drf_serializers.ValidationError("The uploaded file is empty.")


def validate_image_file(file_obj, max_size_mb):
    """For upload points that only accept images (Expense/Post images)."""
    _validate_upload_basics(file_obj, max_size_mb)
    return validate_image_content(file_obj)


def validate_receipt_file(file_obj, max_size_mb):
    """For upload points that accept an image OR a PDF (payment receipts)."""
    _validate_upload_basics(file_obj, max_size_mb)
    name = file_obj.name.lower()
    ext = name.rsplit('.', 1)[-1] if '.' in name else ''
    if ext in ('jpg', 'jpeg', 'png'):
        return validate_image_content(file_obj)
    if ext == 'pdf':
        return validate_pdf_content(file_obj)
    raise drf_serializers.ValidationError("Unsupported file type. Allowed: JPG, PNG, PDF.")


def safe_filter(queryset, **lookups):
    """Apply .filter(**lookups), returning an empty queryset instead of raising
    when a value doesn't match its field's expected type (e.g. a non-UUID
    string against a UUID FK, an unparsable date, or a non-numeric amount).
    Needed for filters built straight from arbitrary, attacker-controlled
    query params, since there is no global DRF exception handler — an
    uncaught ValueError/ValidationError here would otherwise surface as a
    raw 500 response.
    """
    try:
        return queryset.filter(**lookups)
    except (ValueError, TypeError, DjangoValidationError):
        return queryset.none()
