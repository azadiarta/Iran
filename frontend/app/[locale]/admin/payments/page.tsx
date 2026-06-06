'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Save, Wallet, Banknote } from 'lucide-react';
import AdminInput from '@/components/admin/fields/AdminInput';
import AdminTextarea from '@/components/admin/fields/AdminTextarea';
import AdminToggle from '@/components/admin/fields/AdminToggle';
import { LionAndSun } from '@/components/animations/IranianSymbols';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { settingsAPI, DefaultSettingItem } from '@/lib/api';

const MANUAL_FIELDS = [
  'payment_manual_bank_name',
  'payment_manual_account_name',
  'payment_manual_account_number',
  'payment_manual_sort_code',
  'payment_manual_reference_prefix',
];
const PAYPAL_FIELDS = ['payment_paypal_email', 'payment_paypal_me_link'];

export default function AdminPaymentsPage() {
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

  const byKey = useMemo(() => {
    const map = new Map<string, DefaultSettingItem>();
    settings.forEach((s) => map.set(s.key, s));
    return map;
  }, [settings]);

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

  function fieldLabel(key: string) {
    const item = byKey.get(key);
    if (item?.description) return item.description;
    return key.replace(/^payment_(manual|paypal)_/, '').replace(/_/g, ' ');
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

  function renderField(key: string, multiline = false) {
    const value = values[key] ?? '';
    return (
      <div key={key} className="flex items-end gap-2">
        <div className="flex-1">
          {multiline ? (
            <AdminTextarea label={fieldLabel(key)} value={value} onChange={(e) => set(key, e.target.value)} rows={2} />
          ) : (
            <AdminInput label={fieldLabel(key)} value={value} onChange={(e) => set(key, e.target.value)} />
          )}
        </div>
        <button
          onClick={() => save(key)}
          disabled={savingKey === key}
          className="flex-shrink-0 flex items-center justify-center rounded-xl px-3 py-2.5 transition-all disabled:opacity-50"
          style={{ border: '1px solid rgba(0,255,255,0.3)', color: '#00ffff', backgroundColor: 'rgba(0,255,255,0.05)' }}
          aria-label="Save"
        >
          <Save className="w-4 h-4" />
        </button>
      </div>
    );
  }

  function renderToggle(key: string, label: string, color: string) {
    const checked = values[key] === 'true';
    return (
      <AdminToggle
        checked={checked}
        onChange={(v) => {
          set(key, v ? 'true' : 'false');
          settingsAPI.update(key, v ? 'true' : 'false')
            .then(() => showToast('success', isRTL ? 'تنظیمات ذخیره شد' : 'Setting saved'))
            .catch(() => showToast('error', isRTL ? 'ذخیره تنظیمات ناموفق بود' : 'Failed to save setting'));
        }}
        label={label}
        description={`${color === '#00ffff' ? (isRTL ? 'فعال‌سازی روش پرداخت دستی' : 'Enable manual bank transfer') : (isRTL ? 'فعال‌سازی پی‌پل' : 'Enable PayPal')}`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-white">{isRTL ? 'تنظیمات پرداخت' : 'Payment Settings'}</h1>
        <p className="text-sm text-white/40 mt-1">{isRTL ? 'پیکربندی روش‌های دریافت مشارکت' : 'Configure how contributions are received'}</p>
      </div>

      {/* Manual Bank Transfer */}
      <div className="admin-glass-card p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <Banknote className="w-4 h-4" style={{ color: '#00ffff' }} />
          {isRTL ? 'انتقال بانکی دستی' : 'Manual Bank Transfer'}
        </h2>
        {renderToggle('payment_manual_enabled', isRTL ? 'فعال' : 'Enabled', '#00ffff')}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MANUAL_FIELDS.map((k) => renderField(k))}
        </div>
        {renderField('payment_manual_instructions', true)}
      </div>

      {/* PayPal */}
      <div className="admin-glass-card p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <Wallet className="w-4 h-4" style={{ color: '#8b5cf6' }} />
          PayPal
        </h2>
        {renderToggle('payment_paypal_enabled', isRTL ? 'فعال' : 'Enabled', '#8b5cf6')}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PAYPAL_FIELDS.map((k) => renderField(k))}
        </div>
        {renderField('payment_paypal_instructions', true)}
      </div>
    </div>
  );
}
