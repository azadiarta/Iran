'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, KeyRound, ShieldCheck, Trash2, Power } from 'lucide-react';
import AdminBadge from '@/components/admin/AdminBadge';
import AdminInput from '@/components/admin/fields/AdminInput';
import AdminSelect from '@/components/admin/fields/AdminSelect';
import AdminTextarea from '@/components/admin/fields/AdminTextarea';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';
import { LionAndSun } from '@/components/animations/IranianSymbols';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { membersAPI, groupsAPI, MemberDetail, AccessGroup } from '@/lib/api';

export default function AdminMemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const id = params?.id as string;
  const isRTL = locale === 'fa';
  const { hasPermission, member: currentMember } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const canManage = !!currentMember?.is_superuser || hasPermission('can_manage_permissions');
  const canDelete = !!currentMember?.is_superuser || hasPermission('can_delete_member');
  const canChangeAnyPassword = !!currentMember?.is_superuser || hasPermission('can_change_any_password');

  const [target, setTarget] = useState<MemberDetail | null>(null);
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile form
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Group change
  const [groupId, setGroupId] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Danger zone
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([membersAPI.getProfile(id), groupsAPI.getList()])
      .then(([memberRes, groupsRes]) => {
        if (cancelled) return;
        const m = memberRes.data as unknown as MemberDetail;
        setTarget(m);
        setFullName(m.full_name);
        setDisplayName(m.display_name);
        setEmail(m.email || '');
        setPhone(m.phone || '');
        const allGroups = groupsRes.data as unknown as AccessGroup[];
        setGroups(allGroups);
        const matched = allGroups.find((g) => g.name === m.group_name);
        if (matched) setGroupId(matched.id);
      })
      .catch(() => showToast('error', isRTL ? 'بارگذاری اطلاعات عضو ناموفق بود' : 'Failed to load member'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, id]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await membersAPI.updateProfile(id, { full_name: fullName, display_name: displayName, email, phone });
      setTarget(res.data as unknown as MemberDetail);
      showToast('success', isRTL ? 'پروفایل با موفقیت به‌روزرسانی شد' : 'Profile updated successfully');
    } catch {
      showToast('error', isRTL ? 'به‌روزرسانی پروفایل ناموفق بود' : 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!groupId) return;
    setSavingGroup(true);
    try {
      const res = await membersAPI.changeGroup(id, groupId);
      setTarget(res.data as unknown as MemberDetail);
      showToast('success', isRTL ? 'گروه عضو با موفقیت تغییر کرد' : 'Member group changed successfully');
    } catch (err: unknown) {
      const status =
        err && typeof err === 'object' && 'response' in err && err.response &&
        typeof err.response === 'object' && 'status' in err.response
          ? (err.response as { status?: number }).status
          : undefined;
      if (status === 403) {
        showToast('warning', isRTL
          ? 'گروه کاربران سوپریوزر را نمی‌توان تغییر داد.'
          : 'The group of a superuser account cannot be changed.');
      } else {
        showToast('error', isRTL ? 'تغییر گروه ناموفق بود' : 'Failed to change group');
      }
    } finally {
      setSavingGroup(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('warning', isRTL ? 'رمزهای عبور مطابقت ندارند' : 'Passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      await membersAPI.changePassword(id, { new_password: newPassword, confirm_new_password: confirmPassword });
      showToast('success', isRTL ? 'رمز عبور با موفقیت تغییر کرد' : 'Password changed successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      showToast('error', isRTL ? 'تغییر رمز عبور ناموفق بود' : 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  }

  async function toggleActive() {
    setActionLoading(true);
    try {
      const wasActive = !!target?.is_active;
      const res = await membersAPI.toggleActive(id, wasActive ? deactivateReason.trim() : undefined);
      const updated = res.data as unknown as { is_active: boolean };
      setTarget((prev) => (prev ? {
        ...prev,
        is_active: updated.is_active,
        deactivation_reason: wasActive ? deactivateReason.trim() : '',
        deactivated_by_name: wasActive ? (currentMember?.display_name || currentMember?.full_name || null) : null,
      } : prev));
      showToast('success', isRTL ? 'وضعیت عضو تغییر کرد' : 'Member status changed');
      setConfirmDeactivate(false);
      setDeactivateReason('');
    } catch {
      showToast('error', isRTL ? 'تغییر وضعیت ناموفق بود' : 'Failed to change status');
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteMember() {
    setActionLoading(true);
    try {
      await membersAPI.delete(id);
      showToast('success', isRTL ? 'عضو با موفقیت حذف شد' : 'Member deleted successfully');
      router.push(`/${locale}/admin/members`);
    } catch {
      showToast('error', isRTL ? 'حذف عضو ناموفق بود' : 'Failed to delete member');
      setActionLoading(false);
      setConfirmDelete(false);
    }
  }

  if (!canManage) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'شما دسترسی مدیریت اعضا را ندارید.' : 'You do not have permission to manage members.'}
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

  if (!target) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'عضو یافت نشد.' : 'Member not found.'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/${locale}/admin/members`)}
          className="p-2 rounded-lg text-white/50 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
          aria-label={isRTL ? 'بازگشت' : 'Back'}
        >
          <ArrowLeft className="w-5 h-5" style={{ transform: isRTL ? 'scaleX(-1)' : 'none' }} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            {target.full_name}
            <AdminBadge status={target.is_active ? 'active' : 'inactive'} />
          </h1>
          <p className="text-sm text-white/40 mt-1">{target.display_name} · {target.group_name || '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile form */}
        <form onSubmit={saveProfile} className="admin-glass-card p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-white/80">{isRTL ? 'ویرایش پروفایل' : 'Edit Profile'}</h2>
          <AdminInput label={isRTL ? 'نام کامل' : 'Full Name'} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <AdminInput label={isRTL ? 'نام نمایشی' : 'Display Name'} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <AdminInput label={isRTL ? 'ایمیل' : 'Email'} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <AdminInput label={isRTL ? 'تلفن' : 'Phone'} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button
            type="submit"
            disabled={savingProfile}
            className="self-start flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
            style={{ backgroundColor: '#00ffff', color: '#0a0a0f', boxShadow: '0 0 16px rgba(0,255,255,0.3)' }}
          >
            <Save className="w-4 h-4" />
            {savingProfile ? (isRTL ? 'در حال ذخیره...' : 'Saving...') : (isRTL ? 'ذخیره تغییرات' : 'Save Changes')}
          </button>
        </form>

        <div className="flex flex-col gap-6">
          {/* Group */}
          <form onSubmit={saveGroup} className="admin-glass-card p-5 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              {isRTL ? 'گروه دسترسی' : 'Access Group'}
            </h2>
            <AdminSelect
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
              placeholder={isRTL ? 'انتخاب گروه' : 'Select group'}
            />
            <button
              type="submit"
              disabled={savingGroup || !groupId}
              className="self-start flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
              style={{ border: '1px solid #8b5cf6', color: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.08)' }}
            >
              {savingGroup ? (isRTL ? 'در حال تغییر...' : 'Changing...') : (isRTL ? 'تغییر گروه' : 'Change Group')}
            </button>
          </form>

          {/* Password */}
          {canChangeAnyPassword && (
            <form onSubmit={savePassword} className="admin-glass-card p-5 flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                <KeyRound className="w-4 h-4" style={{ color: '#fbbf24' }} />
                {isRTL ? 'تغییر رمز عبور' : 'Change Password'}
              </h2>
              <AdminInput
                label={isRTL ? 'رمز عبور جدید' : 'New Password'}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <AdminInput
                label={isRTL ? 'تکرار رمز عبور' : 'Confirm Password'}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="submit"
                disabled={savingPassword || !newPassword || !confirmPassword}
                className="self-start flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
                style={{ border: '1px solid #fbbf24', color: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.08)' }}
              >
                {savingPassword ? (isRTL ? 'در حال تغییر...' : 'Changing...') : (isRTL ? 'تغییر رمز' : 'Change Password')}
              </button>
            </form>
          )}

          {/* Danger zone */}
          <div className="admin-glass-card p-5 flex flex-col gap-4" style={{ border: '1px solid rgba(239,68,68,0.25)' }}>
            <h2 className="text-sm font-semibold" style={{ color: '#ef4444' }}>
              {isRTL ? 'منطقه خطر' : 'Danger Zone'}
            </h2>
            {!target.is_active && (target.deactivation_reason || target.deactivated_by_name) && (
              <div className="text-xs text-white/50 rounded-lg p-3" style={{ backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                {target.deactivation_reason && (
                  <p>
                    <span className="font-semibold text-white/70">{isRTL ? 'دلیل: ' : 'Reason: '}</span>
                    {target.deactivation_reason}
                  </p>
                )}
                {target.deactivated_by_name && (
                  <p>
                    <span className="font-semibold text-white/70">{isRTL ? 'توسط: ' : 'By: '}</span>
                    {target.deactivated_by_name}
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setConfirmDeactivate(true)}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
                style={{ border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.06)' }}
              >
                <Power className="w-4 h-4" />
                {target.is_active ? (isRTL ? 'غیرفعال‌سازی' : 'Deactivate') : (isRTL ? 'فعال‌سازی' : 'Activate')}
              </button>
              {canDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
                  style={{ border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.06)' }}
                >
                  <Trash2 className="w-4 h-4" />
                  {isRTL ? 'حذف عضو' : 'Delete Member'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <AdminConfirmDialog
        isOpen={confirmDeactivate}
        onClose={() => { setConfirmDeactivate(false); setDeactivateReason(''); }}
        onConfirm={toggleActive}
        loading={actionLoading}
        title={target.is_active ? (isRTL ? 'غیرفعال‌سازی عضو' : 'Deactivate Member') : (isRTL ? 'فعال‌سازی عضو' : 'Activate Member')}
        message={
          target.is_active
            ? (isRTL ? `آیا از غیرفعال‌سازی «${target.full_name}» مطمئن هستید؟` : `Are you sure you want to deactivate "${target.full_name}"?`)
            : (isRTL ? `آیا از فعال‌سازی «${target.full_name}» مطمئن هستید؟` : `Are you sure you want to activate "${target.full_name}"?`)
        }
        confirmLabel={target.is_active ? (isRTL ? 'غیرفعال کن' : 'Deactivate') : (isRTL ? 'فعال کن' : 'Activate')}
        cancelLabel={isRTL ? 'انصراف' : 'Cancel'}
      >
        {target.is_active && (
          <AdminTextarea
            label={isRTL ? 'دلیل غیرفعال‌سازی (به عضو نمایش داده می‌شود)' : 'Deactivation reason (shown to the member)'}
            value={deactivateReason}
            onChange={(e) => setDeactivateReason(e.target.value)}
            rows={3}
          />
        )}
      </AdminConfirmDialog>

      <AdminConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteMember}
        loading={actionLoading}
        title={isRTL ? 'حذف عضو' : 'Delete Member'}
        message={isRTL ? `این عمل غیرقابل بازگشت است. آیا از حذف «${target.full_name}» مطمئن هستید؟` : `This action is irreversible. Are you sure you want to delete "${target.full_name}"?`}
        confirmLabel={isRTL ? 'حذف کن' : 'Delete'}
        cancelLabel={isRTL ? 'انصراف' : 'Cancel'}
      />
    </div>
  );
}
