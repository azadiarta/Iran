'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { authAPI } from '@/lib/api';
import useAuthStore from '@/store/authStore';
import { LionAndSun } from '@/components/animations/IranianSymbols';
import Turnstile from '@/components/common/Turnstile';
import { useTransientError } from '@/hooks/useFieldFeedback';
import {
  isValidPhoneOrEmail,
  isValidPhoneLenient,
  isValidEmail,
  requiredFieldError,
  emailFormatError,
  phoneLenientFormatError,
  detectCredentialKind,
  EMAIL_MAX_LENGTH,
} from '@/lib/validation';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale as string || 'en';
  const { login, isAuthenticated, member: authMember, hasHydrated } = useAuthStore();
  const isRTL = locale === 'fa';

  const [credential, setCredential] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ credential?: string; password?: string }>({});
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const credentialFeedback = useTransientError(fieldErrors.credential);
  const passwordFeedback = useTransientError(fieldErrors.password);

  useEffect(() => {
    if (!hasHydrated) return;
    if (isAuthenticated && authMember) {
      router.replace(`/${locale}`);
    }
  }, [hasHydrated, isAuthenticated, authMember, locale, router]);

  // Detects whether the shared phone-or-email box looks like a phone or an
  // email as the user types, so the right real-time validator applies. This
  // is purely advisory for the inline hint — actual submission below always
  // uses isValidPhoneOrEmail's OR check, so a misdetected "kind" can never
  // block a credential that's genuinely valid as the other type.
  function handleCredentialChange(value: string) {
    setCredential(value);
    const kind = detectCredentialKind(value);
    let credentialError: string | undefined;
    if (kind === 'phone') {
      if (!isValidPhoneLenient(value)) credentialError = phoneLenientFormatError(isRTL);
    } else if (kind === 'email') {
      if (!isValidEmail(value)) credentialError = emailFormatError(isRTL);
    }
    setFieldErrors((prev) => ({ ...prev, credential: credentialError }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const errors: { credential?: string; password?: string } = {};
    if (!credential.trim()) {
      errors.credential = requiredFieldError(isRTL);
    } else if (!isValidPhoneOrEmail(credential)) {
      errors.credential = t('credential_format_error');
    }
    if (!password) {
      errors.password = requiredFieldError(isRTL);
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (!captchaToken) {
      setError(tc('captcha_required_error'));
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.login(credential.trim(), password, captchaToken);
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
        const res = (err as { response: { data: { message?: string; detail?: string } } }).response;
        setError(res.data?.message || res.data?.detail || 'Login failed. Please try again.');
      } else {
        setError('Login failed. Please check your connection and try again.');
      }
      setCaptchaToken('');
      setCaptchaResetKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }

  if (!hasHydrated || (isAuthenticated && authMember)) {
    return null;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-16"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8"
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
            {t('login_title')}
          </h1>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">

          {/* Credential input */}
          <div className="space-y-1.5">
            <label
              htmlFor="credential"
              className="block text-sm font-medium"
              style={{ color: '#00ffff' }}
            >
              {t('credential_label')}
            </label>
            <input
              id="credential"
              type="text"
              autoComplete="username"
              value={credential}
              onChange={(e) => handleCredentialChange(e.target.value)}
              disabled={loading}
              maxLength={EMAIL_MAX_LENGTH}
              className="w-full rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none transition-all duration-200 disabled:opacity-50"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border:
                  credentialFeedback.status === 'error'
                    ? '1px solid #ef4444'
                    : credentialFeedback.status === 'success'
                    ? '1px solid #10b981'
                    : '1px solid rgba(255,255,255,0.1)',
              }}
              onFocus={(e) => {
                if (credentialFeedback.status === 'idle') {
                  e.currentTarget.style.border = '1px solid #00ffff';
                  e.currentTarget.style.boxShadow = '0 0 12px rgba(0,255,255,0.2)';
                }
              }}
              onBlur={(e) => {
                if (credentialFeedback.status === 'idle') {
                  e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
              placeholder="you@example.com"
            />
            <div className="flex items-start justify-between gap-2">
              {credentialFeedback.message ? (
                <p
                  className="text-xs transition-colors duration-300"
                  style={{ color: credentialFeedback.status === 'success' ? '#10b981' : '#ef4444' }}
                  role="alert"
                >
                  {credentialFeedback.message}
                </p>
              ) : (
                <span />
              )}
              <p className="text-xs text-white/30 whitespace-nowrap">
                {credential.length}/{EMAIL_MAX_LENGTH}
              </p>
            </div>
          </div>

          {/* Password input */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium"
              style={{ color: '#00ffff' }}
            >
              {t('password_label')}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }}
                disabled={loading}
                className="w-full rounded-xl px-4 py-3 pr-12 text-white placeholder-white/30 outline-none transition-all duration-200 disabled:opacity-50"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border:
                    passwordFeedback.status === 'error'
                      ? '1px solid #ef4444'
                      : passwordFeedback.status === 'success'
                      ? '1px solid #10b981'
                      : '1px solid rgba(255,255,255,0.1)',
                }}
                onFocus={(e) => {
                  if (passwordFeedback.status === 'idle') {
                    e.currentTarget.style.border = '1px solid #00ffff';
                    e.currentTarget.style.boxShadow = '0 0 12px rgba(0,255,255,0.2)';
                  }
                }}
                onBlur={(e) => {
                  if (passwordFeedback.status === 'idle') {
                    e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
                placeholder="••••••••"
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
            {passwordFeedback.message && (
              <p
                className="text-xs transition-colors duration-300"
                style={{ color: passwordFeedback.status === 'success' ? '#10b981' : '#ef4444' }}
                role="alert"
              >
                {passwordFeedback.message}
              </p>
            )}
          </div>

          {/* CAPTCHA */}
          <div className="flex justify-center">
            <Turnstile
              onVerify={setCaptchaToken}
              onExpire={() => setCaptchaToken('')}
              resetKey={captchaResetKey}
            />
          </div>

          {/* Error message */}
          {error && (
            <p
              className="text-sm rounded-lg px-3 py-2"
              style={{
                color: '#ef4444',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
              role="alert"
            >
              {error}
            </p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || !captchaToken}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-base transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
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
                Signing in…
              </>
            ) : (
              <>
                <LogIn size={18} />
                {t('login_btn')}
              </>
            )}
          </button>
        </form>

        {/* Register link */}
        <p className="mt-6 text-center text-white/50 text-sm">
          {t('no_account')}{' '}
          <Link
            href={`/${locale}/register`}
            className="font-medium transition-colors duration-200"
            style={{ color: '#00ffff' }}
            onMouseEnter={(e) => (e.currentTarget.style.textShadow = '0 0 8px #00ffff')}
            onMouseLeave={(e) => (e.currentTarget.style.textShadow = 'none')}
          >
            {t('register_link')}
          </Link>
        </p>
      </div>
    </div>
  );
}
