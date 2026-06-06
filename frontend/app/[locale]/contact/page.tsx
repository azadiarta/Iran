'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Mail, Phone, Send, CheckCircle } from 'lucide-react';
import { settingsAPI } from '@/lib/api';
import { LionAndSun } from '@/components/animations/IranianSymbols';

interface ContactInfo {
  email: string | null;
  phone: string | null;
}

export default function ContactPage() {
  const t = useTranslations('contact');

  const [contactInfo, setContactInfo] = useState<ContactInfo>({ email: null, phone: null });
  const [formData, setFormData] = useState({ name: '', contact: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent('Contact Form');
    const body = encodeURIComponent(
      `Name: ${formData.name}\nContact: ${formData.contact}\n\nMessage:\n${formData.message}`
    );
    const mailto = contactInfo.email
      ? `mailto:${contactInfo.email}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`;
    window.open(mailto, '_blank');
    setSubmitted(true);
  };

  const hasContactInfo = contactInfo.email || contactInfo.phone;

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 outline-none focus:border-[#00ffff] focus:ring-1 focus:ring-[#00ffff]/30 transition-all';

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
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
                  onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                  placeholder={t('name_placeholder')}
                  className={inputClass}
                />
              </div>

              {/* Email or phone */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  {t('contact_label')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.contact}
                  onChange={(e) => setFormData((d) => ({ ...d, contact: e.target.value }))}
                  placeholder={t('contact_placeholder')}
                  className={inputClass}
                />
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
                  onChange={(e) => setFormData((d) => ({ ...d, message: e.target.value }))}
                  placeholder={t('message_placeholder')}
                  className={inputClass + ' resize-none'}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all"
                style={{
                  backgroundColor: '#00ffff',
                  color: '#0a0a0f',
                  boxShadow: '0 0 24px rgba(0,255,255,0.3)',
                }}
              >
                <Send className="w-4 h-4" />
                {t('send_button')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
