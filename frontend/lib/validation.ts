// Shared client-side validation rules, mirroring backend/core/validators.py.
// These run BEFORE submission for instant feedback; the backend re-checks
// everything regardless, since client-side checks can always be bypassed.

export const SHORT_TEXT_MAX_LENGTH = 150;
export const LONG_TEXT_PUBLIC_MAX_LENGTH = 250;
export const LONG_TEXT_ADMIN_MAX_LENGTH = 550;

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

export function maxLengthError(isRTL: boolean, max: number): string {
  return isRTL ? `حداکثر ${max} نویسه مجاز است.` : `Must be ${max} characters or fewer.`;
}
