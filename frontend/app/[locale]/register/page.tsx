'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { authAPI } from '@/lib/api';
import useAuthStore from '@/store/authStore';
import { LionAndSun } from '@/components/animations/IranianSymbols';
import {
  isValidPhoneStrict,
  isValidEmail,
  maxLengthError,
  passwordTooShortError,
  passwordMismatchError,
  requiredFieldError,
  emailFormatError,
  PHONE_PLACEHOLDER,
  EMAIL_MAX_LENGTH,
} from '@/lib/validation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormFields {
  full_name: string;
  display_name: string;
  phone: string;
  email: string;
  password: string;
  confirm_password: string;
}

interface FieldErrors {
  full_name?: string;
  display_name?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirm_password?: string;
  non_field?: string;
  [key: string]: string | undefined;
}

// ─── Reusable field component ─────────────────────────────────────────────────

function Field({
  id,
  label,
  type = 'text',
  value,
  onChange,
  disabled,
  placeholder,
  required,
  hint,
  error,
  rightElement,
  maxLength,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  rightElement?: React.ReactNode;
  maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: '#00ffff' }}>
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          className="w-full rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none transition-all duration-200 disabled:opacity-50"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: error ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
            paddingRight: rightElement ? '3rem' : undefined,
          }}
          onFocus={(e) => {
            if (!error) {
              e.currentTarget.style.border = '1px solid #00ffff';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(0,255,255,0.2)';
            }
          }}
          onBlur={(e) => {
            if (!error) {
              e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
      {(hint || error || typeof maxLength === 'number') && (
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            {hint && !error && (
              <p className="text-xs" style={{ color: 'rgba(251,191,36,0.6)' }}>
                {hint}
              </p>
            )}
            {error && (
              <p className="text-xs" style={{ color: '#ef4444' }} role="alert">
                {error}
              </p>
            )}
          </div>
          {typeof maxLength === 'number' && (
            <p className="text-xs text-white/30 whitespace-nowrap">
              {value.length}/{maxLength}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RegisterPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale as string || 'en';
  const { login, isAuthenticated, member: authMember, hasHydrated } = useAuthStore();

  const [form, setForm] = useState<FormFields>({
    full_name: '',
    display_name: '',
    phone: '',
    email: '',
    password: '',
    confirm_password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState('');

  useEffect(() => {
    if (!hasHydrated) return;
    if (isAuthenticated && authMember) {
      router.replace(`/${locale}`);
    }
  }, [hasHydrated, isAuthenticated, authMember, locale, router]);

  const isRTL = locale === 'fa';

  function setField(key: keyof FormFields) {
    return (value: string) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      // Clear field error on change
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    };
  }

  function handlePasswordChange(value: string) {
    setForm((prev) => ({ ...prev, password: value }));
    setFieldErrors((prev) => ({
      ...prev,
      password: passwordTooShortError(isRTL, value),
      confirm_password:
        form.confirm_password && value !== form.confirm_password
          ? passwordMismatchError(isRTL)
          : undefined,
    }));
  }

  function handleConfirmPasswordChange(value: string) {
    setForm((prev) => ({ ...prev, confirm_password: value }));
    setFieldErrors((prev) => ({
      ...prev,
      confirm_password: value && value !== form.password ? passwordMismatchError(isRTL) : undefined,
    }));
  }

  function handlePhoneChange(value: string) {
    setForm((prev) => ({ ...prev, phone: value }));
    setFieldErrors((prev) => ({
      ...prev,
      phone: value.trim() && !isValidPhoneStrict(value) ? t('phone_format_error') : undefined,
    }));
  }

  function handleEmailChange(value: string) {
    setForm((prev) => ({ ...prev, email: value }));
    setFieldErrors((prev) => ({
      ...prev,
      email: value.trim() && !isValidEmail(value) ? emailFormatError(isRTL) : undefined,
    }));
  }

  function validate(): boolean {
    const errors: FieldErrors = {};

    if (!form.full_name.trim()) {
      errors.full_name = requiredFieldError(isRTL);
    } else if (form.full_name.trim().length > 35) {
      errors.full_name = maxLengthError(isRTL, 35);
    }

    if (form.display_name.trim().length > 20) {
      errors.display_name = maxLengthError(isRTL, 20);
    }

    if (!form.phone.trim() && !form.email.trim()) {
      errors.phone = requiredFieldError(isRTL);
      errors.email = requiredFieldError(isRTL);
    }

    if (form.phone.trim() && !isValidPhoneStrict(form.phone)) {
      errors.phone = t('phone_format_error');
    }

    if (form.email.trim() && !isValidEmail(form.email)) {
      errors.email = emailFormatError(isRTL);
    }

    if (!form.password) {
      errors.password = requiredFieldError(isRTL);
    } else {
      const pwError = passwordTooShortError(isRTL, form.password);
      if (pwError) errors.password = pwError;
    }

    if (form.password !== form.confirm_password) {
      errors.confirm_password = passwordMismatchError(isRTL);
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError('');

    if (!validate()) return;

    setLoading(true);
    try {
      const payload: {
        full_name: string;
        display_name?: string;
        phone?: string;
        email?: string;
        password: string;
        password_confirm: string;
      } = {
        full_name: form.full_name.trim(),
        password: form.password,
        password_confirm: form.confirm_password,
      };
      if (form.display_name.trim()) payload.display_name = form.display_name.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.email.trim()) payload.email = form.email.trim();

      const res = await authAPI.register(payload);
      const { tokens, member } = res.data as unknown as {
        tokens: { access: string; refresh: string };
        member: Parameters<typeof login>[0];
      };

      login(member, { access: tokens.access, refresh: tokens.refresh });
      router.push(`/${locale}`);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response
      ) {
        const res = (
          err as { response: { data: { message?: string; detail?: string; [key: string]: unknown } } }
        ).response;
        const data = res.data;

        // Try to map field-level errors from DRF
        const newFieldErrors: FieldErrors = {};
        let hasFieldErrors = false;

        for (const key of Object.keys(data)) {
          if (key === 'message' || key === 'success') continue;
          const val = data[key];
          if (key === 'non_field_errors' || key === 'detail') {
            const msg = Array.isArray(val) ? val[0] : String(val);
            newFieldErrors.non_field = msg;
            hasFieldErrors = true;
          } else if (
            ['full_name', 'display_name', 'phone', 'email', 'password'].includes(key)
          ) {
            newFieldErrors[key] = Array.isArray(val) ? val[0] : String(val);
            hasFieldErrors = true;
          }
        }

        if (hasFieldErrors) {
          setFieldErrors(newFieldErrors);
          if (newFieldErrors.non_field) {
            setGeneralError(newFieldErrors.non_field);
          }
        } else {
          setGeneralError(data?.message || data?.detail || 'Registration failed. Please try again.');
        }
      } else {
        setGeneralError('Registration failed. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  const phoneOrEmailHint = t('phone_or_email_hint');

  if (!hasHydrated || (isAuthenticated && authMember)) {
    return null;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-16"
      style={{ background: '#0a0a0f' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8"
        style={{ boxShadow: '0 0 60px rgba(0,0,0,0.5)' }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div style={{ color: '#fbbf24' }}>
            <LionAndSun size={56} animated />
          </div>
          <h1
            className="text-3xl font-bold mt-4"
            style={{ color: '#00ffff', textShadow: '0 0 15px rgba(0,255,255,0.7)' }}
          >
            {t('register_title')}
          </h1>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          <Field
            id="full_name"
            label={t('full_name_label')}
            value={form.full_name}
            onChange={setField('full_name')}
            disabled={loading}
            placeholder="Ali Hosseini"
            required
            error={fieldErrors.full_name}
            maxLength={35}
          />

          <Field
            id="display_name"
            label={t('display_name_label')}
            value={form.display_name}
            onChange={setField('display_name')}
            disabled={loading}
            placeholder="Ali"
            error={fieldErrors.display_name}
            maxLength={20}
          />

          <Field
            id="phone"
            label={t('phone_label')}
            type="tel"
            value={form.phone}
            onChange={handlePhoneChange}
            disabled={loading}
            placeholder={PHONE_PLACEHOLDER}
            hint={
              form.phone.trim()
                ? t('phone_format_hint')
                : form.email.trim()
                  ? undefined
                  : phoneOrEmailHint
            }
            error={fieldErrors.phone}
            maxLength={17}
          />

          <Field
            id="email"
            label={t('email_label')}
            type="email"
            value={form.email}
            onChange={handleEmailChange}
            disabled={loading}
            placeholder="you@example.com"
            hint={!form.phone.trim() && !form.email.trim() ? phoneOrEmailHint : undefined}
            error={fieldErrors.email}
            maxLength={EMAIL_MAX_LENGTH}
          />

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium" style={{ color: '#00ffff' }}>
              {t('password_label')}
              <span className="ml-1 text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                disabled={loading}
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-3 pr-12 text-white placeholder-white/30 outline-none transition-all duration-200 disabled:opacity-50"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: fieldErrors.password ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                }}
                onFocus={(e) => {
                  if (!fieldErrors.password) {
                    e.currentTarget.style.border = '1px solid #00ffff';
                    e.currentTarget.style.boxShadow = '0 0 12px rgba(0,255,255,0.2)';
                  }
                }}
                onBlur={(e) => {
                  if (!fieldErrors.password) {
                    e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/80 transition-colors disabled:opacity-50"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="text-xs" style={{ color: '#ef4444' }} role="alert">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label htmlFor="confirm_password" className="block text-sm font-medium" style={{ color: '#00ffff' }}>
              {t('confirm_password_label')}
              <span className="ml-1 text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                id="confirm_password"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.confirm_password}
                onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                disabled={loading}
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-3 pr-12 text-white placeholder-white/30 outline-none transition-all duration-200 disabled:opacity-50"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: fieldErrors.confirm_password ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                }}
                onFocus={(e) => {
                  if (!fieldErrors.confirm_password) {
                    e.currentTarget.style.border = '1px solid #00ffff';
                    e.currentTarget.style.boxShadow = '0 0 12px rgba(0,255,255,0.2)';
                  }
                }}
                onBlur={(e) => {
                  if (!fieldErrors.confirm_password) {
                    e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/80 transition-colors disabled:opacity-50"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.confirm_password && (
              <p className="text-xs" style={{ color: '#ef4444' }} role="alert">
                {fieldErrors.confirm_password}
              </p>
            )}
          </div>

          {/* General error */}
          {generalError && (
            <p
              className="text-sm rounded-lg px-3 py-2"
              style={{
                color: '#ef4444',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
              role="alert"
            >
              {generalError}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-base transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            style={{
              background: 'rgba(0,255,255,0.1)',
              border: '1px solid #00ffff',
              color: '#00ffff',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,255,0.2)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(0,255,255,0.3)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,255,0.1)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            }}
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Creating account…
              </>
            ) : (
              <>
                <UserPlus size={18} />
                {t('register_btn')}
              </>
            )}
          </button>
        </form>

        {/* Login link */}
        <p className="mt-6 text-center text-white/50 text-sm">
          {t('has_account')}{' '}
          <Link
            href={`/${locale}/login`}
            className="font-medium transition-colors duration-200"
            style={{ color: '#00ffff' }}
            onMouseEnter={(e) => (e.currentTarget.style.textShadow = '0 0 8px #00ffff')}
            onMouseLeave={(e) => (e.currentTarget.style.textShadow = 'none')}
          >
            {t('login_link')}
          </Link>
        </p>
      </div>
    </div>
  );
}
