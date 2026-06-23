'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Mail, Phone, Send, CheckCircle, AlertTriangle } from 'lucide-react';
import { settingsAPI, contactAPI } from '@/lib/api';
import { LionAndSun } from '@/components/animations/IranianSymbols';
import Turnstile from '@/components/common/Turnstile';
import useAuthStore from '@/store/authStore';
import { useTransientError } from '@/hooks/useFieldFeedback';
import {
  SHORT_TEXT_PUBLIC_MAX_LENGTH,
  LONG_TEXT_PUBLIC_MAX_LENGTH,
  requiredFieldError,
  isValidPhoneOrEmail,
  phoneOrEmailFormatError,
} from '@/lib/validation';

interface ContactInfo {
  email: string | null;
  phone: string | null;
}

export default function ContactPage() {
  const t = useTranslations('contact');
  const tCommon = useTranslations('common');
  const params = useParams();
  const isRTL = ((params?.locale as 'en' | 'fa') || 'en') === 'fa';
  const { member } = useAuthStore();

  const [contactInfo, setContactInfo] = useState<ContactInfo>({ email: null, phone: null });
  const [formData, setFormData] = useState({ name: '', contact: '', message: '' });
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; contact?: string; message?: string }>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const nameFeedback = useTransientError(fieldErrors.name);
  const contactFeedback = useTransientError(fieldErrors.contact);
  const messageFeedback = useTransientError(fieldErrors.message);

  function handleNameChange(value: string) {
    setFormData((d) => ({ ...d, name: value }));
    setFieldErrors((p) => ({ ...p, name: value.trim() ? undefined : requiredFieldError(isRTL) }));
  }

  function contactFieldError(value: string): string | undefined {
    if (!value.trim()) return requiredFieldError(isRTL);
    if (!isValidPhoneOrEmail(value)) return phoneOrEmailFormatError(isRTL);
    return undefined;
  }

  function handleContactChange(value: string) {
    setFormData((d) => ({ ...d, contact: value }));
    setFieldErrors((p) => ({ ...p, contact: contactFieldError(value) }));
  }

  function handleMessageChange(value: string) {
    setFormData((d) => ({ ...d, message: value }));
    setFieldErrors((p) => ({ ...p, message: value.trim() ? undefined : requiredFieldError(isRTL) }));
  }

  function validateForm(): boolean {
    const errors: { name?: string; contact?: string; message?: string } = {
      name: formData.name.trim() ? undefined : requiredFieldError(isRTL),
      contact: contactFieldError(formData.contact),
      message: formData.message.trim() ? undefined : requiredFieldError(isRTL),
    };
    setFieldErrors(errors);
    return !errors.name && !errors.contact && !errors.message;
  }
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && member) {
      setFormData((d) => ({ ...d, name: member.full_name }));
    }
  }, [mounted, member]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await settingsAPI.getPublicSettings();
        if (!res) return;
        const results = res.data as unknown as { key: string; value: string }[];
        if (!Array.isArray(results)) return;
        const emailSetting = results.find((s) => s.key === 'contact_email');
        const phoneSetting = results.find((s) => s.key === 'contact_phone');
        setContactInfo({
          email: emailSetting?.value || null,
          phone: phoneSetting?.value || null,
        });
      } catch {
        // Silently ignore — contact info section simply won't show
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!validateForm()) return;

    if (!captchaToken) {
      setSubmitError(tCommon('captcha_required_error'));
      return;
    }

    setSubmitting(true);
    try {
      await contactAPI.submit({
        name: formData.name,
        contact_info: formData.contact,
        message: formData.message,
        captcha_token: captchaToken,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const status =
        err && typeof err === 'object' && 'response' in err && err.response &&
        typeof err.response === 'object' && 'status' in err.response
          ? (err.response as { status?: number }).status
          : undefined;
      setSubmitError(status === 429 ? t('pending_limit_error') : t('submit_error'));
      setCaptchaToken('');
      setCaptchaResetKey((k) => k + 1);
    } finally {
      setSubmitting(false);
    }
  };

  const hasContactInfo = contactInfo.email || contactInfo.phone;

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 outline-none focus:border-[#00ffff] focus:ring-1 focus:ring-[#00ffff]/30 transition-all';

  return (
    <div className="min-h-screen text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
          {/* Deactivated account banner */}
          {mounted && member?.is_active === false && (
            <div
              className="rounded-xl border p-4 mb-6 text-sm text-center space-y-1"
              style={{
                borderColor: 'rgba(245,158,11,0.3)',
                backgroundColor: 'rgba(245,158,11,0.08)',
                color: '#f59e0b',
              }}
            >
              <p className="font-semibold">{tCommon('deactivated_title')}</p>
              <p>{tCommon('deactivated_message')}</p>
            </div>
          )}

          {/* Icon + title */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 16px rgba(251,191,36,0.5))' }}>
              <LionAndSun size={48} />
            </div>
            <h1
              className="text-2xl font-bold text-center"
              style={{ color: '#00ffff', textShadow: '0 0 20px rgba(0,255,255,0.4)' }}
            >
              {t('title')}
            </h1>
          </div>

          {/* Contact info section */}
          {hasContactInfo ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-6 space-y-3">
              {contactInfo.email && (
                <a
                  href={`mailto:${contactInfo.email}`}
                  className="flex items-center gap-3 text-sm group"
                >
                  <Mail
                    className="w-4 h-4 flex-shrink-0 group-hover:scale-110 transition-transform"
                    style={{ color: '#00ffff' }}
                  />
                  <span className="text-white/70 group-hover:text-white transition-colors break-all">
                    {contactInfo.email}
                  </span>
                </a>
              )}
              {contactInfo.phone && (
                <a
                  href={`tel:${contactInfo.phone}`}
                  className="flex items-center gap-3 text-sm group"
                >
                  <Phone
                    className="w-4 h-4 flex-shrink-0 group-hover:scale-110 transition-transform"
                    style={{ color: '#00ffff' }}
                  />
                  <span className="text-white/70 group-hover:text-white transition-colors">
                    {contactInfo.phone}
                  </span>
                </a>
              )}
            </div>
          ) : (
            <div
              className="rounded-xl border p-4 mb-6 text-sm text-center"
              style={{
                borderColor: 'rgba(245,158,11,0.3)',
                backgroundColor: 'rgba(245,158,11,0.08)',
                color: '#f59e0b',
              }}
            >
              {t('no_contact')}
            </div>
          )}

          {/* Contact form */}
          {submitted ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <CheckCircle
                className="w-14 h-14"
                style={{
                  color: '#10b981',
                  filter: 'drop-shadow(0 0 16px rgba(16,185,129,0.5))',
                }}
              />
              <p
                className="text-base font-semibold text-center"
                style={{ color: '#10b981' }}
              >
                {t('success_msg')}
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setFormData({ name: '', contact: '', message: '' });
                  setFieldErrors({});
                  setCaptchaToken('');
                  setCaptchaResetKey((k) => k + 1);
                }}
                className="text-sm text-white/40 hover:text-white/70 transition-colors underline"
              >
                {t('send_another')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">{t('name_label')}</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder={t('name_placeholder')}
                  disabled={mounted && !!member}
                  maxLength={SHORT_TEXT_PUBLIC_MAX_LENGTH}
                  className={inputClass + (mounted && member ? ' opacity-60 cursor-not-allowed' : '')}
                  style={{
                    borderColor:
                      nameFeedback.status === 'error'
                        ? '#ef4444'
                        : nameFeedback.status === 'success'
                        ? '#10b981'
                        : 'rgba(255,255,255,0.1)',
                  }}
                />
                {!(mounted && member) && (
                  <div className="mt-1 flex items-start justify-between gap-2">
                    {nameFeedback.message ? (
                      <p
                        className="text-xs transition-colors duration-300"
                        style={{ color: nameFeedback.status === 'success' ? '#10b981' : '#ef4444' }}
                      >
                        {nameFeedback.message}
                      </p>
                    ) : <span />}
                    <p className="text-xs text-white/30 text-right whitespace-nowrap">
                      {formData.name.length}/{SHORT_TEXT_PUBLIC_MAX_LENGTH}
                    </p>
                  </div>
                )}
              </div>

              {/* Member ID (read-only, shown only when logged in) */}
              {mounted && member && (
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">{t('member_id_label')}</label>
                  <input
                    type="text"
                    value={`#${member.member_number ?? ''}`}
                    disabled
                    className={inputClass + ' opacity-60 cursor-not-allowed'}
                  />
                </div>
              )}

              {/* Email or phone */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  {t('contact_label')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.contact}
                  onChange={(e) => handleContactChange(e.target.value)}
                  placeholder={t('contact_placeholder')}
                  maxLength={SHORT_TEXT_PUBLIC_MAX_LENGTH}
                  className={inputClass}
                  style={{
                    borderColor:
                      contactFeedback.status === 'error'
                        ? '#ef4444'
                        : contactFeedback.status === 'success'
                        ? '#10b981'
                        : 'rgba(255,255,255,0.1)',
                  }}
                />
                <div className="mt-1 flex items-start justify-between gap-2">
                  {contactFeedback.message ? (
                    <p
                      className="text-xs transition-colors duration-300"
                      style={{ color: contactFeedback.status === 'success' ? '#10b981' : '#ef4444' }}
                    >
                      {contactFeedback.message}
                    </p>
                  ) : <span />}
                  <p className="text-xs text-white/30 text-right whitespace-nowrap">
                    {formData.contact.length}/{SHORT_TEXT_PUBLIC_MAX_LENGTH}
                  </p>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  {t('message_label')}
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => handleMessageChange(e.target.value)}
                  placeholder={t('message_placeholder')}
                  maxLength={LONG_TEXT_PUBLIC_MAX_LENGTH}
                  className={inputClass + ' resize-none'}
                  style={{
                    borderColor:
                      messageFeedback.status === 'error'
                        ? '#ef4444'
                        : messageFeedback.status === 'success'
                        ? '#10b981'
                        : 'rgba(255,255,255,0.1)',
                  }}
                />
                <div className="mt-1 flex items-start justify-between gap-2">
                  {messageFeedback.message ? (
                    <p
                      className="text-xs transition-colors duration-300"
                      style={{ color: messageFeedback.status === 'success' ? '#10b981' : '#ef4444' }}
                    >
                      {messageFeedback.message}
                    </p>
                  ) : <span />}
                  <p className="text-xs text-white/30 text-right whitespace-nowrap">
                    {formData.message.length}/{LONG_TEXT_PUBLIC_MAX_LENGTH}
                  </p>
                </div>
              </div>

              {/* CAPTCHA */}
              <div className="flex justify-center">
                <Turnstile
                  onVerify={setCaptchaToken}
                  onExpire={() => setCaptchaToken('')}
                  resetKey={captchaResetKey}
                />
              </div>

              {/* Error */}
              {submitError && (
                <div
                  className="rounded-xl border p-3 flex items-start gap-2 text-sm"
                  style={{ borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !captchaToken}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                style={{
                  backgroundColor: '#00ffff',
                  color: '#0a0a0f',
                  boxShadow: '0 0 24px rgba(0,255,255,0.3)',
                }}
              >
                <Send className="w-4 h-4" />
                {submitting ? tCommon('submitting') : t('send_button')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
