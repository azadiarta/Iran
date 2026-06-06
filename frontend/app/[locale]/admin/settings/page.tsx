'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import AdminInput from '@/components/admin/fields/AdminInput';
import { LionAndSun } from '@/components/animations/IranianSymbols';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { settingsAPI, DefaultSettingItem } from '@/lib/api';

const PAYMENT_PREFIXES = ['payment_manual_', 'payment_paypal_', 'payment_stripe_', 'payment_google_pay_'];

export default function AdminSettingsPage() {
  const params = useParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const { member: currentMember } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const isSuperuser = !!currentMember?.is_superuser;

  const [settings, setSettings] = useState<DefaultSettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperuser) {
      setLoading(false);
      return;
    }
    settingsAPI
      .getAll()
      .then((res) => {
        const data = res.data as unknown as DefaultSettingItem[];
        setSettings(data);
        const map: Record<string, string> = {};
        data.forEach((s) => { map[s.key] = s.value; });
        setValues(map);
      })
      .catch(() => showToast('error', isRTL ? 'بارگذاری تنظیمات ناموفق بود' : 'Failed to load settings'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperuser]);

  // General settings = everything that isn't payment-related (those live on /admin/payments)
  const general = settings.filter((s) => !PAYMENT_PREFIXES.some((p) => s.key.startsWith(p)));

  function set(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function save(key: string) {
    setSavingKey(key);
    try {
      await settingsAPI.update(key, values[key] ?? '');
      showToast('success', isRTL ? 'تنظیمات ذخیره شد' : 'Setting saved');
    } catch {
      showToast('error', isRTL ? 'ذخیره تنظیمات ناموفق بود' : 'Failed to save setting');
    } finally {
      setSavingKey(null);
    }
  }

  if (!isSuperuser) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'این بخش فقط برای مدیران ارشد در دسترس است.' : 'This section is only available to superusers.'}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LionAndSun size={48} animated />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-white">{isRTL ? 'تنظیمات سامانه' : 'System Settings'}</h1>
        <p className="text-sm text-white/40 mt-1">{isRTL ? 'پیکربندی مقادیر پیش‌فرض سامانه' : 'Configure system-wide default values'}</p>
      </div>

      <div className="admin-glass-card p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <SettingsIcon className="w-4 h-4" style={{ color: '#00ffff' }} />
          {isRTL ? 'تنظیمات عمومی' : 'General Settings'}
        </h2>

        {general.length === 0 ? (
          <p className="text-sm text-white/30 py-6 text-center">{isRTL ? 'تنظیماتی یافت نشد' : 'No settings found'}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {general.map((s) => (
              <div key={s.key} className="flex items-end gap-2">
                <div className="flex-1">
                  <AdminInput
                    label={s.description || s.key}
                    value={values[s.key] ?? ''}
                    onChange={(e) => set(s.key, e.target.value)}
                  />
                  <p className="mt-1 text-[10px] text-white/25 font-mono">{s.key}</p>
                </div>
                <button
                  onClick={() => save(s.key)}
                  disabled={savingKey === s.key}
                  className="flex-shrink-0 flex items-center justify-center rounded-xl px-3 py-2.5 transition-all disabled:opacity-50"
                  style={{ border: '1px solid rgba(0,255,255,0.3)', color: '#00ffff', backgroundColor: 'rgba(0,255,255,0.05)' }}
                  aria-label="Save"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
