// Shared client-side validation rules, mirroring backend/core/validators.py.
// These run BEFORE submission for instant feedback; the backend re-checks
// everything regardless, since client-side checks can always be bypassed.

// Generic single-line "short text" boxes (name/title/message-style fields,
// not the intentionally tighter name fields like full_name/display_name and
// not the LONG_TEXT_* textarea fields below): public-site forms cap at 50,
// the same field edited from the admin panel caps at 100.
export const SHORT_TEXT_PUBLIC_MAX_LENGTH = 50;
export const SHORT_TEXT_ADMIN_MAX_LENGTH = 100;
export const LONG_TEXT_PUBLIC_MAX_LENGTH = 250;
export const LONG_TEXT_ADMIN_MAX_LENGTH = 550;

export const PASSWORD_MIN_LENGTH = 8;

// Mirrors backend EMAIL_MAX_LENGTH (core/validators.py) — real addresses
// never get remotely close to Django's default 254-char field limit.
export const EMAIL_MAX_LENGTH = 75;

// Strict format required for new phone entries: "00" prefix (never "+"),
// then 6-15 digits, e.g. 00447700900000.
const PHONE_REGEX = /^00\d{6,15}$/;

// Looser shape accepted for pre-existing/unchanged values (login, updates
// that didn't touch the phone field).
const LENIENT_PHONE_REGEX = /^(00|\+)?\d{6,15}$/;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PHONE_PLACEHOLDER = '00447700900000';

export function isValidPhoneStrict(value: string): boolean {
  return PHONE_REGEX.test(value.trim());
}

export function isValidPhoneLenient(value: string): boolean {
  return LENIENT_PHONE_REGEX.test(value.trim());
}

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

export function isValidPhoneOrEmail(value: string): boolean {
  const v = value.trim();
  return isValidEmail(v) || isValidPhoneLenient(v);
}

// For combined phone-or-email fields (login's "credential" box): detects
// which one the user is most likely typing, from the first character only,
// so real-time validation can apply the matching rule and never the wrong
// one (which would otherwise block a valid login). Digits and "+" mean
// phone (the lenient login format allows both prefixes); anything else
// (starts with a letter, etc.) means email. Empty input has no kind yet.
export function detectCredentialKind(value: string): 'phone' | 'email' | null {
  const v = value.trim();
  if (!v) return null;
  return /^[\d+]/.test(v) ? 'phone' : 'email';
}

export function phoneHint(isRTL: boolean): string {
  return isRTL
    ? 'با ۰۰ و سپس کد کشور شروع کنید (مثال: 00447700900000)'
    : "Start with '00' then the country code (e.g. 00447700900000)";
}

export function phoneFormatError(isRTL: boolean): string {
  return isRTL
    ? 'شماره تلفن باید با ۰۰ و سپس کد کشور و شماره همراه شروع شود (مثال: 00447700900000).'
    : "Phone number must start with '00' followed by the country code and number (e.g. 00447700900000).";
}

export function phoneOrEmailFormatError(isRTL: boolean): string {
  return isRTL
    ? 'یک ایمیل یا شماره تلفن معتبر وارد کنید (شماره تلفن باید با ۰۰ شروع شود).'
    : 'Enter a valid email address or phone number (starting with 00, e.g. 00447700900000).';
}

// Lenient phone-format error for the login credential box, which accepts
// pre-existing "+"-prefixed numbers too (unlike the strict "00"-only
// format required for new submissions on the register/profile forms).
export function phoneLenientFormatError(isRTL: boolean): string {
  return isRTL
    ? 'شماره تلفن باید با ۰۰ شروع شود و فقط شامل عدد باشد (مثال: 00447700900000).'
    : "Phone number must start with '00' followed by digits only (e.g. 00447700900000).";
}

export function maxLengthError(isRTL: boolean, max: number): string {
  return isRTL ? `حداکثر ${max} نویسه مجاز است.` : `Must be ${max} characters or fewer.`;
}

// Real-time password-strength check, used as the user types (not just on submit).
// Returns the error reason, or undefined if the password already satisfies the rule.
export function passwordTooShortError(isRTL: boolean, value: string): string | undefined {
  if (!value || value.length >= PASSWORD_MIN_LENGTH) return undefined;
  return isRTL
    ? `رمز عبور باید حداقل ${PASSWORD_MIN_LENGTH} نویسه باشد. (${value.length}/${PASSWORD_MIN_LENGTH})`
    : `Password must be at least ${PASSWORD_MIN_LENGTH} characters. (${value.length}/${PASSWORD_MIN_LENGTH})`;
}

export function passwordMismatchError(isRTL: boolean): string {
  return isRTL ? 'رمزهای عبور مطابقت ندارند.' : 'Passwords do not match.';
}

export function requiredFieldError(isRTL: boolean): string {
  return isRTL ? 'این فیلد الزامی است.' : 'This field is required.';
}

export function emailFormatError(isRTL: boolean): string {
  return isRTL ? 'یک نشانی ایمیل معتبر وارد کنید.' : 'Enter a valid email address.';
}
