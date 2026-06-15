'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Server, RotateCcw, Save, X, Plus, RefreshCw } from 'lucide-react';
import AdminInput from '@/components/admin/fields/AdminInput';
import AdminToggle from '@/components/admin/fields/AdminToggle';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';
import { LionAndSun } from '@/components/animations/IranianSymbols';
import useToastStore from '@/store/toastStore';
import { envVarsAPI, EnvVarItem } from '@/lib/api';
import { ENV_VAR_META, ENV_VAR_SECTIONS } from '@/lib/envVarsMeta';

const SECTION_ORDER = ['debug', 'hosts', 'https', 's3', 'secret_key', 'database', 'frontend', 'platform'];

const SOURCE_LABEL: Record<string, { en: string; fa: string }> = {
  env: { en: 'from environment', fa: 'از متغیر محیطی' },
  override: { en: 'overridden here', fa: 'تغییریافته در اینجا' },
  'auto-detected': { en: 'auto-detected', fa: 'شناسایی خودکار' },
  default: { en: 'default', fa: 'پیش‌فرض' },
};

export default function EnvVarsPage() {
  const params = useParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const showToast = useToastStore((s) => s.show);

  const [items, setItems] = useState<EnvVarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [newExtra, setNewExtra] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<null | { type: 'reset-all' } | { type: 'reset-section'; section: string } | { type: 'regenerate' }>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const load = () => {
    setLoading(true);
    envVarsAPI
      .getAll()
      .then((res) => {
        const data = res.data as unknown as EnvVarItem[];
        setItems(data);
        const map: Record<string, string | boolean> = {};
        data.forEach((it) => {
          if (it.value_type === 'bool') map[it.key] = it.value as boolean;
          else if (it.value_type === 'string' || it.value_type === 'secret') map[it.key] = it.value as string;
        });
        setValues(map);
      })
      .catch(() => showToast('error', isRTL ? 'بارگذاری متغیرها ناموفق بود' : 'Failed to load environment variables'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveBool(key: string) {
    setSavingKey(key);
    try {
      await envVarsAPI.update(key, !!values[key]);
      showToast('success', isRTL ? 'ذخیره شد' : 'Saved');
      load();
    } catch {
      showToast('error', isRTL ? 'ذخیره ناموفق بود' : 'Save failed');
    } finally {
      setSavingKey(null);
    }
  }

  async function saveString(key: string) {
    const val = (values[key] as string) ?? '';
    if (!val.trim()) return;
    setSavingKey(key);
    try {
      await envVarsAPI.update(key, val);
      showToast('success', isRTL ? 'ذخیره شد' : 'Saved');
      load();
    } catch {
      showToast('error', isRTL ? 'ذخیره ناموفق بود' : 'Save failed');
    } finally {
      setSavingKey(null);
    }
  }

  async function addExtra(item: EnvVarItem) {
    const val = (newExtra[item.key] || '').trim();
    if (!val) return;
    const current = (item.value as string[]) || [];
    if (current.includes(val)) {
      setNewExtra((p) => ({ ...p, [item.key]: '' }));
      return;
    }
    setSavingKey(item.key);
    try {
      await envVarsAPI.update(item.key, [...current, val]);
      setNewExtra((p) => ({ ...p, [item.key]: '' }));
      showToast('success', isRTL ? 'افزوده شد' : 'Added');
      load();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { errors?: { value?: string[] } } } })?.response?.data?.errors?.value?.[0];
      showToast('error', message || (isRTL ? 'افزودن ناموفق بود' : 'Add failed'));
    } finally {
      setSavingKey(null);
    }
  }

  async function removeExtra(item: EnvVarItem, value: string) {
    const current = (item.value as string[]) || [];
    setSavingKey(item.key);
    try {
      await envVarsAPI.update(item.key, current.filter((v) => v !== value));
      showToast('success', isRTL ? 'حذف شد' : 'Removed');
      load();
    } catch {
      showToast('error', isRTL ? 'حذف ناموفق بود' : 'Remove failed');
    } finally {
      setSavingKey(null);
    }
  }

  async function resetKey(key: string) {
    setSavingKey(key);
    try {
      await envVarsAPI.reset(key);
      showToast('success', isRTL ? 'به مقدار پیش‌فرض بازگشت' : 'Reset to default');
      load();
    } catch {
      showToast('error', isRTL ? 'بازنشانی ناموفق بود' : 'Reset failed');
    } finally {
      setSavingKey(null);
    }
  }

  async function handleConfirm() {
    if (!confirm) return;
    setConfirmLoading(true);
    try {
      if (confirm.type === 'reset-all') {
        await envVarsAPI.resetAll();
        showToast('success', isRTL ? 'همه‌ی موارد به پیش‌فرض بازگشت' : 'Everything reset to default');
      } else if (confirm.type === 'reset-section') {
        const keys = items.filter((it) => it.section === confirm.section && it.category !== 'readonly' && it.source === 'override').map((it) => it.key);
        for (const key of keys) {
          await envVarsAPI.reset(key);
        }
        showToast('success', isRTL ? 'این بخش به پیش‌فرض بازگشت' : 'Section reset to default');
      } else if (confirm.type === 'regenerate') {
        await envVarsAPI.regenerateSecret('SECRET_KEY');
        showToast('success', isRTL ? 'کلید مخفی بازتولید شد' : 'Secret key regenerated');
      }
      load();
    } catch {
      showToast('error', isRTL ? 'عملیات ناموفق بود' : 'Operation failed');
    } finally {
      setConfirmLoading(false);
      setConfirm(null);
    }
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Server className="w-6 h-6" style={{ color: '#00ffff' }} />
            {isRTL ? 'متغیرهای محیطی' : 'Environment Variables'}
          </h1>
          <p className="text-sm text-white/40 mt-1">
            {isRTL
              ? 'مشاهده و ویرایش تنظیمات استقرار و زمان‌اجرا. مقادیر «زنده» ظرف حدود ۳۰ ثانیه اعمال می‌شوند؛ بقیه نیاز به ری‌استارت دارند.'
              : 'View and edit deployment/runtime configuration. "Live" values apply within ~30 seconds; others require a restart.'}
          </p>
        </div>
        <button
          onClick={() => setConfirm({ type: 'reset-all' })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.05)' }}
        >
          <RotateCcw className="w-4 h-4" />
          {isRTL ? 'بازنشانی همه به پیش‌فرض' : 'Reset All to Default'}
        </button>
      </div>

      {SECTION_ORDER.map((section) => {
        const sectionItems = items.filter((it) => it.section === section);
        if (sectionItems.length === 0) return null;
        const sectionTitle = ENV_VAR_SECTIONS[section];
        const hasOverride = sectionItems.some((it) => it.source === 'override');

        return (
          <div key={section} className="admin-glass-card p-5 flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white/80">{isRTL ? sectionTitle.fa : sectionTitle.en}</h2>
              {hasOverride && (
                <button
                  onClick={() => setConfirm({ type: 'reset-section', section })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.03)' }}
                >
                  <RotateCcw className="w-3 h-3" />
                  {isRTL ? 'بازنشانی این بخش' : 'Reset Section'}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4">
              {sectionItems.map((item) => (
                <EnvVarRow
                  key={item.key}
                  item={item}
                  isRTL={isRTL}
                  value={values[item.key]}
                  saving={savingKey === item.key}
                  newExtraValue={newExtra[item.key] || ''}
                  onChange={(v) => setValues((p) => ({ ...p, [item.key]: v }))}
                  onNewExtraChange={(v) => setNewExtra((p) => ({ ...p, [item.key]: v }))}
                  onSaveBool={() => saveBool(item.key)}
                  onSaveString={() => saveString(item.key)}
                  onAddExtra={() => addExtra(item)}
                  onRemoveExtra={(v) => removeExtra(item, v)}
                  onReset={() => resetKey(item.key)}
                  onRegenerate={() => setConfirm({ type: 'regenerate' })}
                />
              ))}
            </div>
          </div>
        );
      })}

      <AdminConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
        loading={confirmLoading}
        title={
          confirm?.type === 'regenerate'
            ? (isRTL ? 'بازتولید کلید مخفی؟' : 'Regenerate secret key?')
            : confirm?.type === 'reset-section'
            ? (isRTL ? 'بازنشانی این بخش؟' : 'Reset this section?')
            : (isRTL ? 'بازنشانی همه چیز؟' : 'Reset everything?')
        }
        message={
          confirm?.type === 'regenerate'
            ? (isRTL
                ? 'این کار همه‌ی نشست‌های فعلی را باطل می‌کند (همه از سیستم خارج می‌شوند) و برای اعمال کامل نیاز به ری‌استارت دارد. این عمل قابل بازگشت نیست.'
                : 'This invalidates ALL current sessions (everyone is logged out) and requires a restart to fully apply. This cannot be undone.')
            : confirm?.type === 'reset-section'
            ? (isRTL ? 'تمام مقادیر تغییریافته‌ی این بخش به مقدار پیش‌فرض بازمی‌گردند.' : 'All overridden values in this section will revert to their defaults.')
            : (isRTL ? 'تمام مقادیر تغییریافته در همه‌ی بخش‌ها به مقدار پیش‌فرض بازمی‌گردند.' : 'All overridden values across every section will revert to their defaults.')
        }
        confirmLabel={confirm?.type === 'regenerate' ? (isRTL ? 'بازتولید' : 'Regenerate') : (isRTL ? 'بازنشانی' : 'Reset')}
        cancelLabel={isRTL ? 'انصراف' : 'Cancel'}
      />
    </div>
  );
}

interface EnvVarRowProps {
  item: EnvVarItem;
  isRTL: boolean;
  value: string | boolean | undefined;
  saving: boolean;
  newExtraValue: string;
  onChange: (v: string | boolean) => void;
  onNewExtraChange: (v: string) => void;
  onSaveBool: () => void;
  onSaveString: () => void;
  onAddExtra: () => void;
  onRemoveExtra: (v: string) => void;
  onReset: () => void;
  onRegenerate: () => void;
}

function EnvVarRow({
  item, isRTL, value, saving, newExtraValue,
  onChange, onNewExtraChange, onSaveBool, onSaveString, onAddExtra, onRemoveExtra, onReset, onRegenerate,
}: EnvVarRowProps) {
  const meta = ENV_VAR_META[item.key];
  const sourceLabel = SOURCE_LABEL[item.source];

  return (
    <div className="rounded-xl px-4 py-3.5" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <span className="text-sm font-medium text-white/80">{meta ? (isRTL ? meta.label.fa : meta.label.en) : item.key}</span>
        <code className="text-[11px] text-white/30">{item.key}</code>
        {sourceLabel && (
          <span
            className="px-2 py-0.5 rounded-md text-[11px]"
            style={{ border: '1px solid rgba(0,255,255,0.25)', color: '#00ffff', backgroundColor: 'rgba(0,255,255,0.05)' }}
          >
            {isRTL ? sourceLabel.fa : sourceLabel.en}
          </span>
        )}
        {item.requires_restart && (
          <span
            className="px-2 py-0.5 rounded-md text-[11px]"
            style={{ border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)' }}
          >
            {isRTL ? 'نیاز به ری‌استارت' : 'Needs restart'}
          </span>
        )}
        {item.source === 'override' && item.category !== 'readonly' && (
          <button
            onClick={onReset}
            disabled={saving}
            className="ms-auto flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] transition-all disabled:opacity-50"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
          >
            <RotateCcw className="w-3 h-3" />
            {isRTL ? 'پیش‌فرض' : 'Default'}
          </button>
        )}
      </div>

      {meta && <p className="text-xs text-white/40 mb-2">{isRTL ? meta.description.fa : meta.description.en}</p>}

      {/* Control */}
      <div className="mb-2">
        {item.value_type === 'bool' && (
          <div className="flex items-center gap-3">
            <AdminToggle checked={!!value} onChange={(c) => onChange(c)} />
            <SaveButton onClick={onSaveBool} loading={saving} isRTL={isRTL} disabled={!!value === (item.value as boolean)} />
          </div>
        )}

        {item.value_type === 'csv_extra' && (
          <div className="flex flex-col gap-2">
            {!!(item.base && item.base.length) && (
              <div className="flex flex-wrap gap-1.5">
                {item.base.map((v) => (
                  <span key={v} className="px-2 py-1 rounded-lg text-xs" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {v}
                  </span>
                ))}
              </div>
            )}
            {!!((item.value as string[])?.length) && (
              <div className="flex flex-wrap gap-1.5">
                {(item.value as string[]).map((v) => (
                  <span key={v} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs" style={{ backgroundColor: 'rgba(0,255,255,0.06)', color: '#00ffff', border: '1px solid rgba(0,255,255,0.25)' }}>
                    {v}
                    <button onClick={() => onRemoveExtra(v)} disabled={saving} aria-label={isRTL ? 'حذف' : 'Remove'}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <AdminInput
                value={newExtraValue}
                onChange={(e) => onNewExtraChange(e.target.value)}
                placeholder={isRTL ? 'افزودن مقدار جدید...' : 'Add a new value...'}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddExtra(); } }}
              />
              <button
                onClick={onAddExtra}
                disabled={saving || !newExtraValue.trim()}
                className="flex-shrink-0 flex items-center justify-center rounded-xl px-3 py-2.5 transition-all disabled:opacity-50"
                style={{ border: '1px solid rgba(0,255,255,0.3)', color: '#00ffff', backgroundColor: 'rgba(0,255,255,0.05)' }}
                aria-label={isRTL ? 'افزودن' : 'Add'}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {(item.value_type === 'string' || item.value_type === 'secret') && item.category !== 'readonly' && (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <AdminInput
                value={(value as string) ?? ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={item.value_type === 'secret' ? (isRTL ? `فعلی: ${item.value}` : `current: ${item.value}`) : undefined}
              />
            </div>
            <SaveButton onClick={onSaveString} loading={saving} isRTL={isRTL} disabled={!(value as string)?.trim()} />
          </div>
        )}

        {item.value_type === 'secret_regenerate' && (
          <div className="flex items-center gap-3">
            <code className="text-xs text-white/40 flex-1">{item.value as string}</code>
            <button
              onClick={onRegenerate}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
              style={{ border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)' }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {isRTL ? 'بازتولید' : 'Regenerate'}
            </button>
          </div>
        )}

        {item.category === 'readonly' && item.value_type !== 'secret_regenerate' && (
          <code className="text-xs text-white/40 break-all">{String(item.value)}</code>
        )}
      </div>

      {meta && (
        <p className="text-[11px] text-white/30">
          <span className="font-semibold text-white/40">{isRTL ? 'اثر تغییر: ' : 'Effect: '}</span>
          {isRTL ? meta.effect.fa : meta.effect.en}
        </p>
      )}

      {meta?.suggested && item.category !== 'readonly' && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {meta.suggested.map((s) => (
            <button
              key={s.value}
              onClick={() => onChange(item.value_type === 'bool' ? s.value === 'true' : s.value)}
              className="px-2 py-1 rounded-lg text-[11px] transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {isRTL ? s.label.fa : s.label.en}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SaveButton({ onClick, loading, isRTL, disabled }: { onClick: () => void; loading: boolean; isRTL: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="flex-shrink-0 flex items-center justify-center rounded-xl px-3 py-2.5 transition-all disabled:opacity-50"
      style={{ border: '1px solid rgba(0,255,255,0.3)', color: '#00ffff', backgroundColor: 'rgba(0,255,255,0.05)' }}
      aria-label={isRTL ? 'ذخیره' : 'Save'}
    >
      <Save className="w-4 h-4" />
    </button>
  );
}
