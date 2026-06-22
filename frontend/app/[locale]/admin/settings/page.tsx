'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import AdminInput from '@/components/admin/fields/AdminInput';
import AdminToggle from '@/components/admin/fields/AdminToggle';
import AdminSelectWithDescription from '@/components/admin/fields/AdminSelectWithDescription';
import { LionAndSun } from '@/components/animations/IranianSymbols';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { settingsAPI, groupsAPI, DefaultSettingItem, AccessGroup } from '@/lib/api';
import { SETTINGS_META } from '@/lib/settingsMeta';
import { isValidPhoneStrict, isValidEmail, phoneFormatError, PHONE_PLACEHOLDER, SHORT_TEXT_ADMIN_MAX_LENGTH } from '@/lib/validation';

const _EMAIL_KEYS = ['contact_email'];
const _PHONE_KEYS = ['contact_phone'];

const PAYMENT_PREFIXES = ['payment_manual_', 'payment_paypal_', 'payment_stripe_', 'payment_google_pay_'];

export default function AdminSettingsPage() {
  const params = useParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const { member: currentMember } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const isSuperuser = !!currentMember?.is_superuser;

  const [settings, setSettings] = useState<DefaultSettingItem[]>([]);
  const [groups, setGroups] = useState<AccessGroup[]>([]);
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
    groupsAPI
      .getList()
      .then((res) => setGroups(res.data as unknown as AccessGroup[]))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperuser]);

  // General settings = everything that isn't payment-related (those live on /admin/payments)
  const general = settings.filter((s) => !PAYMENT_PREFIXES.some((p) => s.key.startsWith(p)));

  function set(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function save(key: string) {
    const value = values[key] ?? '';
    if (value && _EMAIL_KEYS.includes(key) && !isValidEmail(value)) {
      showToast('warning', isRTL ? 'ایمیل وارد شده معتبر نیست' : 'Enter a valid email address');
      return;
    }
    if (value && _PHONE_KEYS.includes(key) && !isValidPhoneStrict(value)) {
      showToast('warning', phoneFormatError(isRTL));
      return;
    }
    setSavingKey(key);
    try {
      await settingsAPI.update(key, value);
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
            {general.map((s) => {
              const meta = SETTINGS_META[s.key];

              if (meta?.type === 'select') {
                const options =
                  s.key === 'default_group'
                    ? groups.map((g) => ({ value: g.id, label: g.name, description: g.description }))
                    : (meta.options || []).map((o) => ({
                        value: o.value,
                        label: isRTL ? o.label.fa : o.label.en,
                        description: isRTL ? o.description.fa : o.description.en,
                      }));
                return (
                  <div
                    key={s.key}
                    className="flex items-end gap-2 rounded-xl px-4 py-3"
                    style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <AdminSelectWithDescription
                        label={isRTL ? meta.label.fa : meta.label.en}
                        value={values[s.key] ?? ''}
                        onChange={(v) => set(s.key, v)}
                        options={options}
                        placeholder={isRTL ? 'انتخاب کنید...' : 'Select...'}
                      />
                      <p className="mt-1.5 text-xs text-white/40">{isRTL ? meta.description.fa : meta.description.en}</p>
                    </div>
                    <SaveButton onClick={() => save(s.key)} loading={savingKey === s.key} isRTL={isRTL} />
                  </div>
                );
              }

              if (meta?.type === 'toggle') {
                return (
                  <div
                    key={s.key}
                    className="flex items-center gap-2 rounded-xl px-4 py-3"
                    style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <AdminToggle
                        checked={values[s.key] === 'true'}
                        onChange={(checked) => set(s.key, checked ? 'true' : 'false')}
                        label={isRTL ? meta.label.fa : meta.label.en}
                        description={isRTL ? meta.description.fa : meta.description.en}
                      />
                    </div>
                    <SaveButton onClick={() => save(s.key)} loading={savingKey === s.key} isRTL={isRTL} />
                  </div>
                );
              }

              return (
                <div
                  key={s.key}
                  className="flex items-end gap-2 rounded-xl px-4 py-3"
                  style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex-1 min-w-0">
                    <AdminInput
                      label={meta ? (isRTL ? meta.label.fa : meta.label.en) : s.description || s.key}
                      type={meta?.type === 'number' ? 'number' : 'text'}
                      value={values[s.key] ?? ''}
                      onChange={(e) => set(s.key, e.target.value)}
                      placeholder={_PHONE_KEYS.includes(s.key) ? PHONE_PLACEHOLDER : undefined}
                      maxLength={meta?.maxLength ?? SHORT_TEXT_ADMIN_MAX_LENGTH}
                    />
                    {meta && <p className="mt-1.5 text-xs text-white/40">{isRTL ? meta.description.fa : meta.description.en}</p>}
                  </div>
                  <SaveButton onClick={() => save(s.key)} loading={savingKey === s.key} isRTL={isRTL} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SaveButton({ onClick, loading, isRTL }: { onClick: () => void; loading: boolean; isRTL: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex-shrink-0 flex items-center justify-center rounded-xl px-3 py-2.5 transition-all disabled:opacity-50"
      style={{ border: '1px solid rgba(0,255,255,0.3)', color: '#00ffff', backgroundColor: 'rgba(0,255,255,0.05)' }}
      aria-label={isRTL ? 'ذخیره' : 'Save'}
    >
      <Save className="w-4 h-4" />
    </button>
  );
}
