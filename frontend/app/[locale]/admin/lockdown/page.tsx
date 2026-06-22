'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ShieldAlert, KeyRound } from 'lucide-react';
import AdminToggle from '@/components/admin/fields/AdminToggle';
import AdminTextarea from '@/components/admin/fields/AdminTextarea';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';
import AdminBadge from '@/components/admin/AdminBadge';
import useAuthStore from '@/store/authStore';
import useLockdownStore from '@/store/lockdownStore';
import useToastStore from '@/store/toastStore';
import { lockdownAPI, LockdownStatus } from '@/lib/api';
import { LONG_TEXT_ADMIN_MAX_LENGTH } from '@/lib/validation';

function errorStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'status' in err.response) {
    return (err.response as { status?: number }).status;
  }
  return undefined;
}

export default function AdminLockdownPage() {
  const params = useParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const { member, hasPermission } = useAuthStore();
  const showToast = useToastStore((s) => s.show);
  const { kind, message: activeMessage, setStatus } = useLockdownStore();

  const isSuperuser = !!member?.is_superuser;
  const canTogglePermission = isSuperuser || hasPermission('can_toggle_lockdown');

  const [suDialogOpen, setSuDialogOpen] = useState(false);
  const [suTurningOn, setSuTurningOn] = useState(false);
  const [suMessage, setSuMessage] = useState('');
  const [suLoading, setSuLoading] = useState(false);

  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [permTurningOn, setPermTurningOn] = useState(false);
  const [permMessage, setPermMessage] = useState('');
  const [permLoading, setPermLoading] = useState(false);

  function openSuDialog(turningOn: boolean) {
    setSuTurningOn(turningOn);
    setSuMessage('');
    setSuDialogOpen(true);
  }

  async function confirmSu() {
    setSuLoading(true);
    try {
      const res = await lockdownAPI.toggleSuperuser(suTurningOn, suMessage.trim() || undefined);
      const data = res.data as unknown as LockdownStatus;
      setStatus(data.kind, data.message);
      showToast(
        'success',
        suTurningOn
          ? (isRTL ? 'قفل کامل سامانه فعال شد.' : 'Site-wide lockdown enabled.')
          : (isRTL ? 'قفل کامل سامانه غیرفعال شد.' : 'Site-wide lockdown disabled.')
      );
      setSuDialogOpen(false);
      setSuMessage('');
    } catch {
      showToast('error', isRTL ? 'تغییر وضعیت ناموفق بود.' : 'Failed to update lockdown.');
    } finally {
      setSuLoading(false);
    }
  }

  function openPermDialog(turningOn: boolean) {
    setPermTurningOn(turningOn);
    setPermMessage('');
    setPermDialogOpen(true);
  }

  async function confirmPerm() {
    setPermLoading(true);
    try {
      const res = await lockdownAPI.togglePermission(permTurningOn, permMessage.trim() || undefined);
      const data = res.data as unknown as LockdownStatus;
      setStatus(data.kind, data.message);
      showToast(
        'success',
        permTurningOn
          ? (isRTL ? 'قفل سامانه برای اعضای عادی فعال شد.' : 'Lockdown for ordinary members enabled.')
          : (isRTL ? 'قفل سامانه برای اعضای عادی غیرفعال شد.' : 'Lockdown for ordinary members disabled.')
      );
      setPermDialogOpen(false);
      setPermMessage('');
    } catch (err) {
      if (errorStatus(err) === 409) {
        showToast('error', isRTL ? 'قفل کامل سامانه (سوپریوزر) در حال حاضر فعال است.' : 'Site-wide superuser lockdown is already active.');
      } else {
        showToast('error', isRTL ? 'تغییر وضعیت ناموفق بود.' : 'Failed to update lockdown.');
      }
    } finally {
      setPermLoading(false);
    }
  }

  if (!isSuperuser && !canTogglePermission) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'شما دسترسی مدیریت قفل سامانه را ندارید.' : 'You do not have permission to manage the site lockdown.'}
      </div>
    );
  }

  const statusBadge =
    kind === 'superuser'
      ? <AdminBadge status="inactive" label={isRTL ? 'قفل کامل (سوپریوزر) فعال' : 'Superuser lockdown active'} />
      : kind === 'permission'
      ? <AdminBadge status="pending" label={isRTL ? 'قفل برای اعضای عادی فعال' : 'Member lockdown active'} />
      : <AdminBadge status="active" label={isRTL ? 'سامانه باز است' : 'Site is open'} />;

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-white">{isRTL ? 'قفل سامانه' : 'Site Lockdown'}</h1>
        <p className="text-sm text-white/40 mt-1">
          {isRTL
            ? 'سامانه را به‌طور موقت برای کاربران غیرفعال کنید و یک پیام سفارشی نمایش دهید.'
            : 'Temporarily disable the site for users and show a custom message.'}
        </p>
      </div>

      <div className="admin-glass-card p-4 flex items-center justify-between gap-3 flex-wrap">
        {statusBadge}
        {kind && (
          <p className="text-xs text-white/50 flex-1 min-w-[12rem]">
            “{activeMessage}”
          </p>
        )}
      </div>

      {isSuperuser && (
        <div className="admin-glass-card p-5 flex flex-col gap-3" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}
              >
                <ShieldAlert className="w-5 h-5" style={{ color: '#ef4444' }} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">
                  {isRTL ? 'قفل کامل سامانه (فقط سوپریوزر)' : 'Site-wide Lockdown (Superuser Only)'}
                </h2>
                <p className="text-xs text-white/40 mt-1 max-w-md">
                  {isRTL
                    ? 'با فعال شدن، کل سامانه (وب و بک‌اند) برای همه — حتی سایر ادمین‌ها — غیرفعال می‌شود؛ فقط سوپریوزر دسترسی کامل دارد. این گزینه همیشه نسبت به قفل دسترسی-محور زیر اولویت دارد.'
                    : 'When enabled, the entire site (frontend and backend) is disabled for everyone — including every other admin — except the superuser. This always takes priority over the permission-based lockdown below.'}
                </p>
              </div>
            </div>
            <AdminToggle checked={kind === 'superuser'} onChange={(v) => openSuDialog(v)} />
          </div>
        </div>
      )}

      {canTogglePermission && (
        <div className="admin-glass-card p-5 flex flex-col gap-3" style={{ border: '1px solid rgba(245,158,11,0.2)' }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}
              >
                <KeyRound className="w-5 h-5" style={{ color: '#f59e0b' }} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">
                  {isRTL ? 'قفل سامانه برای اعضای عادی' : 'Lockdown for Ordinary Members'}
                </h2>
                <p className="text-xs text-white/40 mt-1 max-w-md">
                  {isRTL
                    ? 'با فعال شدن، سامانه فقط برای اعضای عادی غیرفعال می‌شود؛ سوپریوزر و هر ادمین (حتی با یک دسترسی) دسترسی کامل به سامانه و پنل مدیریت را حفظ می‌کنند.'
                    : 'When enabled, the site is disabled only for ordinary members; the superuser and every admin (even with just one permission) keep full access to the site and admin panel.'}
                </p>
              </div>
            </div>
            <AdminToggle
              checked={kind === 'permission'}
              onChange={(v) => openPermDialog(v)}
              disabled={kind === 'superuser'}
            />
          </div>
          {kind === 'superuser' && (
            <p className="text-xs" style={{ color: '#f59e0b' }}>
              {isRTL
                ? 'غیرفعال است چون قفل کامل سامانه (سوپریوزر) در حال حاضر فعال است.'
                : 'Disabled because the site-wide superuser lockdown is currently active.'}
            </p>
          )}
        </div>
      )}

      <AdminConfirmDialog
        isOpen={suDialogOpen}
        onClose={() => { setSuDialogOpen(false); setSuMessage(''); }}
        onConfirm={confirmSu}
        loading={suLoading}
        title={suTurningOn ? (isRTL ? 'فعال‌سازی قفل کامل سامانه' : 'Enable Site-wide Lockdown') : (isRTL ? 'غیرفعال‌سازی قفل کامل سامانه' : 'Disable Site-wide Lockdown')}
        message={
          suTurningOn
            ? (isRTL
                ? `کل سامانه برای همه به‌جز سوپریوزر غیرفعال می‌شود.${kind === 'permission' ? ' قفل دسترسی-محور فعلی به‌طور خودکار غیرفعال خواهد شد.' : ''}`
                : `The entire site will be disabled for everyone except the superuser.${kind === 'permission' ? ' The currently active permission-based lockdown will be automatically disabled.' : ''}`)
            : (isRTL ? 'آیا از غیرفعال‌سازی قفل کامل سامانه مطمئن هستید؟' : 'Are you sure you want to disable the site-wide lockdown?')
        }
        confirmLabel={suTurningOn ? (isRTL ? 'فعال کن' : 'Enable') : (isRTL ? 'غیرفعال کن' : 'Disable')}
        cancelLabel={isRTL ? 'انصراف' : 'Cancel'}
      >
        <AdminTextarea
          label={
            suTurningOn
              ? (isRTL
                  ? 'پیامی که به بازدیدکنندگان نمایش داده می‌شود (اختیاری — در صورت خالی بودن، متن پیش‌فرض نمایش داده می‌شود)'
                  : 'Message shown to visitors (optional — a default message is shown if left empty)')
              : (isRTL ? 'یادداشت اختیاری (می‌توانید خالی بگذارید)' : 'Optional note (you may leave this empty)')
          }
          value={suMessage}
          onChange={(e) => setSuMessage(e.target.value)}
          rows={3}
          maxLength={LONG_TEXT_ADMIN_MAX_LENGTH}
        />
      </AdminConfirmDialog>

      <AdminConfirmDialog
        isOpen={permDialogOpen}
        onClose={() => { setPermDialogOpen(false); setPermMessage(''); }}
        onConfirm={confirmPerm}
        loading={permLoading}
        title={permTurningOn ? (isRTL ? 'فعال‌سازی قفل اعضای عادی' : 'Enable Member Lockdown') : (isRTL ? 'غیرفعال‌سازی قفل اعضای عادی' : 'Disable Member Lockdown')}
        message={
          permTurningOn
            ? (isRTL
                ? 'سامانه فقط برای اعضای عادی غیرفعال می‌شود؛ ادمین‌ها و سوپریوزر دسترسی کامل خواهند داشت.'
                : 'The site will be disabled only for ordinary members; admins and the superuser will keep full access.')
            : (isRTL ? 'آیا از غیرفعال‌سازی قفل اعضای عادی مطمئن هستید؟' : 'Are you sure you want to disable the member lockdown?')
        }
        confirmLabel={permTurningOn ? (isRTL ? 'فعال کن' : 'Enable') : (isRTL ? 'غیرفعال کن' : 'Disable')}
        cancelLabel={isRTL ? 'انصراف' : 'Cancel'}
      >
        <AdminTextarea
          label={
            permTurningOn
              ? (isRTL
                  ? 'پیامی که به اعضای عادی نمایش داده می‌شود (اختیاری — در صورت خالی بودن، متن پیش‌فرض نمایش داده می‌شود)'
                  : 'Message shown to ordinary members (optional — a default message is shown if left empty)')
              : (isRTL ? 'یادداشت اختیاری (می‌توانید خالی بگذارید)' : 'Optional note (you may leave this empty)')
          }
          value={permMessage}
          onChange={(e) => setPermMessage(e.target.value)}
          rows={3}
          maxLength={LONG_TEXT_ADMIN_MAX_LENGTH}
        />
      </AdminConfirmDialog>
    </div>
  );
}
