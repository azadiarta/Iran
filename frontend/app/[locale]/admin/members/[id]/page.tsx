'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, KeyRound, ShieldCheck, Trash2, Power, MessageSquare, HandCoins, Mail, ScrollText, ExternalLink, Hash } from 'lucide-react';
import AdminBadge from '@/components/admin/AdminBadge';
import AdminInput from '@/components/admin/fields/AdminInput';
import AdminSelect from '@/components/admin/fields/AdminSelect';
import AdminTextarea from '@/components/admin/fields/AdminTextarea';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';
import PasswordRequirementsChecklist from '@/components/common/PasswordRequirementsChecklist';
import { LionAndSun } from '@/components/animations/IranianSymbols';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import {
  membersAPI,
  groupsAPI,
  MemberDetail,
  MemberFullProfile,
  AccessGroup,
  CommentDetail,
  Contribution,
  ContactMessage,
  ActivityLogEntry,
} from '@/lib/api';
import {
  isValidPhoneStrict,
  isValidEmail,
  phoneFormatError,
  emailFormatError,
  maxLengthError,
  PHONE_PLACEHOLDER,
  LONG_TEXT_ADMIN_MAX_LENGTH,
  passwordStrengthError,
  passwordMismatchError,
  EMAIL_MAX_LENGTH,
  MEMBER_NUMBER_LENGTH,
  MEMBER_NUMBER_MIN,
  MEMBER_NUMBER_MAX,
  memberNumberFormatError,
} from '@/lib/validation';

interface ProfileFieldErrors {
  full_name?: string;
  display_name?: string;
  email?: string;
  phone?: string;
}

export default function AdminMemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const id = params?.id as string;
  const isRTL = locale === 'fa';
  const { hasPermission, member: currentMember } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const canManage = !!currentMember?.is_superuser || hasPermission('can_manage_permissions');
  // Three independent tiers, matching the backend's serializer branching
  // (accounts.member_views): full detail, delete/deactivate-only minimal
  // (adds is_active), or bare name+ID minimal. Each works standalone — a
  // viewer holding only one of these must still be able to reach this page
  // and use exactly the one action their permission grants, nothing more.
  const canViewFull = canManage || hasPermission('can_view_member_details');
  const canDeleteOrDeactivate = canManage || hasPermission('can_delete_member');
  // The literal delete action stays narrower than "deactivate" — deliberately
  // not OR'd with can_manage_permissions, mirroring MemberDeleteView's own
  // permission_classes (destructive actions are never folded into the
  // general admin permission).
  const canDelete = !!currentMember?.is_superuser || hasPermission('can_delete_member');
  const canChangeAnyPassword = !!currentMember?.is_superuser || hasPermission('can_change_any_password');
  const canView = canViewFull || canDeleteOrDeactivate || canChangeAnyPassword;

  const [target, setTarget] = useState<MemberDetail | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<CommentDetail[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);

  // Profile form
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [originalPhone, setOriginalPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Group change
  const [groupId, setGroupId] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);

  const [profileFieldErrors, setProfileFieldErrors] = useState<ProfileFieldErrors>({});

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<{ new_password?: string; confirm_password?: string }>({});

  // Member number change (superuser-only, works even on superuser targets)
  const [memberNumberInput, setMemberNumberInput] = useState('');
  const [savingMemberNumber, setSavingMemberNumber] = useState(false);
  const [memberNumberError, setMemberNumberError] = useState<string | undefined>(undefined);

  // Danger zone
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const profileRes = await membersAPI.getFullProfile(id);
        if (cancelled) return;
        const profile = profileRes.data as unknown as MemberFullProfile;
        const m = profile.member;
        setTarget(m);
        setFullName(m.full_name);
        setDisplayName(m.display_name || '');
        setEmail(m.email || '');
        setPhone(m.phone || '');
        setOriginalPhone(m.phone || '');
        setComments(profile.comments);
        setContributions(profile.contributions);
        setContactMessages(profile.contact_messages);
        setActivityLogs(profile.activity_logs);

        if (canManage) {
          const groupsRes = await groupsAPI.getList();
          if (cancelled) return;
          const allGroups = groupsRes.data as unknown as AccessGroup[];
          setGroups(allGroups);
          const matched = allGroups.find((g) => g.name === m.group_name);
          if (matched) setGroupId(matched.id);
        }
      } catch (err: unknown) {
        const status =
          err && typeof err === 'object' && 'response' in err && err.response &&
          typeof err.response === 'object' && 'status' in err.response
            ? (err.response as { status?: number }).status
            : undefined;
        if (cancelled) return;
        // The backend deliberately returns the same generic 404 for "doesn't
        // exist" and "exists but is a hidden superuser" (so probing an ID
        // can't be used to discover who's a superuser) — so this branch must
        // stay equally generic and not name the superuser reason specifically,
        // or it would defeat that. Status can be 403 (DRF permission_classes
        // rejection) or 404 (the view's own explicit member-not-found/hidden
        // response); both land here.
        if (status === 403 || status === 404) {
          setAccessDenied(true);
        } else {
          showToast('error', isRTL ? 'بارگذاری اطلاعات عضو ناموفق بود' : 'Failed to load member');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, canManage, id]);

  function fmt(n: number) {
    return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(n);
  }

  function handleFullNameChange(value: string) {
    setFullName(value);
    setProfileFieldErrors((prev) => ({ ...prev, full_name: value.trim().length > 35 ? maxLengthError(isRTL, 35) : undefined }));
  }

  function handleDisplayNameChange(value: string) {
    setDisplayName(value);
    setProfileFieldErrors((prev) => ({ ...prev, display_name: value.trim().length > 20 ? maxLengthError(isRTL, 20) : undefined }));
  }

  function handleProfileEmailChange(value: string) {
    setEmail(value);
    setProfileFieldErrors((prev) => ({ ...prev, email: value.trim() && !isValidEmail(value) ? emailFormatError(isRTL) : undefined }));
  }

  function handleProfilePhoneChange(value: string) {
    setPhone(value);
    // Only enforce strict "00"-prefixed format if the phone is being changed,
    // mirroring the backend (legacy numbers must not block unrelated edits).
    setProfileFieldErrors((prev) => ({
      ...prev,
      phone: value.trim() && value.trim() !== originalPhone && !isValidPhoneStrict(value) ? phoneFormatError(isRTL) : undefined,
    }));
  }

  function validateProfile(): boolean {
    const errors: ProfileFieldErrors = {};
    if (fullName.trim().length > 35) errors.full_name = maxLengthError(isRTL, 35);
    if (displayName.trim().length > 20) errors.display_name = maxLengthError(isRTL, 20);
    if (email.trim() && !isValidEmail(email)) errors.email = emailFormatError(isRTL);
    if (phone.trim() && phone.trim() !== originalPhone && !isValidPhoneStrict(phone)) errors.phone = phoneFormatError(isRTL);
    setProfileFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!validateProfile()) return;
    setSavingProfile(true);
    try {
      const res = await membersAPI.updateProfile(id, { full_name: fullName, display_name: displayName, email, phone });
      setTarget(res.data as unknown as MemberDetail);
      setOriginalPhone(phone.trim());
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

  function handleNewPasswordChange(value: string) {
    setNewPassword(value);
    setPasswordFieldErrors((prev) => ({
      ...prev,
      new_password: passwordStrengthError(isRTL, value),
      confirm_password:
        confirmPassword && value !== confirmPassword ? passwordMismatchError(isRTL) : undefined,
    }));
  }

  function handleConfirmPasswordChange(value: string) {
    setConfirmPassword(value);
    setPasswordFieldErrors((prev) => ({
      ...prev,
      confirm_password: value && value !== newPassword ? passwordMismatchError(isRTL) : undefined,
    }));
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    const lengthError = passwordStrengthError(isRTL, newPassword);
    if (lengthError) {
      showToast('warning', lengthError);
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('warning', passwordMismatchError(isRTL));
      return;
    }
    setSavingPassword(true);
    try {
      await membersAPI.changePassword(id, { new_password: newPassword, confirm_new_password: confirmPassword });
      showToast('success', isRTL ? 'رمز عبور با موفقیت تغییر کرد' : 'Password changed successfully');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordFieldErrors({});
    } catch {
      showToast('error', isRTL ? 'تغییر رمز عبور ناموفق بود' : 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  }

  function handleMemberNumberChange(value: string) {
    const digitsOnly = value.replace(/\D/g, '').slice(0, MEMBER_NUMBER_LENGTH);
    setMemberNumberInput(digitsOnly);
    if (!digitsOnly) {
      setMemberNumberError(undefined);
      return;
    }
    const parsed = parseInt(digitsOnly, 10);
    if (digitsOnly.length < MEMBER_NUMBER_LENGTH || parsed < MEMBER_NUMBER_MIN || parsed > MEMBER_NUMBER_MAX) {
      setMemberNumberError(memberNumberFormatError(isRTL));
    } else {
      setMemberNumberError(undefined);
    }
  }

  async function saveMemberNumber(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseInt(memberNumberInput, 10);
    if (
      !memberNumberInput.trim() ||
      Number.isNaN(parsed) ||
      memberNumberInput.length < MEMBER_NUMBER_LENGTH ||
      parsed < MEMBER_NUMBER_MIN ||
      parsed > MEMBER_NUMBER_MAX
    ) {
      setMemberNumberError(memberNumberFormatError(isRTL));
      return;
    }
    setSavingMemberNumber(true);
    try {
      const res = await membersAPI.updateMemberNumber(id, parsed);
      setTarget(res.data as unknown as MemberDetail);
      setMemberNumberInput('');
      setMemberNumberError(undefined);
      showToast('success', isRTL ? 'شماره عضویت با موفقیت تغییر کرد' : 'Member number updated successfully');
    } catch (err: unknown) {
      const data =
        err && typeof err === 'object' && 'response' in err && err.response &&
        typeof err.response === 'object' && 'data' in err.response
          ? (err.response as { data?: { errors?: { member_number?: string[] } } }).data
          : undefined;
      const fieldError = data?.errors?.member_number?.[0];
      setMemberNumberError(fieldError || (isRTL ? 'تغییر شماره عضویت ناموفق بود' : 'Failed to update member number'));
    } finally {
      setSavingMemberNumber(false);
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

  if (!canView) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'شما دسترسی مشاهده جزئیات اعضا را ندارید.' : 'You do not have permission to view member details.'}
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

  if (accessDenied) {
    // Deliberately generic: the backend returns the same response whether
    // the ID doesn't exist or belongs to a hidden superuser, specifically so
    // this page can't be used to discover who's a superuser by guessing IDs.
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'عضو یافت نشد یا دسترسی به آن ندارید.' : 'Member not found or you do not have access to it.'}
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
            {/* is_active is absent from the bare-minimal payload a
                can_change_any_password-only viewer receives — omit the
                badge entirely rather than guess at "inactive". */}
            {target.is_active !== undefined && <AdminBadge status={target.is_active ? 'active' : 'inactive'} />}
          </h1>
          <p className="text-sm text-white/40 mt-1">
            {(() => {
              const parts: React.ReactNode[] = [];
              if (target.member_number != null) parts.push(`#${target.member_number}`);
              if (target.display_name) parts.push(target.display_name);
              // group/superuser status is only part of the full-detail
              // payload — a restricted-tier viewer's target never has it.
              if (canViewFull) {
                parts.push(
                  target.is_superuser ? (
                    <span className="font-bold" style={{ color: '#fbbf24' }}>{isRTL ? 'سوپریوزر' : 'Superuser'}</span>
                  ) : (
                    target.group_name || '—'
                  )
                );
              }
              return parts.map((part, i) => (
                <span key={i}>
                  {i > 0 && ' · '}
                  {part}
                </span>
              ));
            })()}
          </p>
        </div>
      </div>

      {currentMember?.is_superuser && (
        <form onSubmit={saveMemberNumber} className="admin-glass-card p-5 flex flex-col gap-4" style={{ border: '1px solid rgba(0,255,255,0.25)' }}>
          <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
            <Hash className="w-4 h-4" style={{ color: '#00ffff' }} />
            {isRTL ? 'شماره عضویت' : 'Member Number'}
          </h2>
          <p className="text-xs text-white/40">
            {isRTL
              ? 'تغییر این مقدار، پیشوند کد پیگیری تمام نظرات، مشارکت‌ها، پیام‌های تماس و پست‌های این عضو را نیز به‌روزرسانی می‌کند.'
              : "Changing this also updates the tracking-code prefix on all of this member's comments, contributions, contact messages, and posts."}
          </p>
          <AdminInput
            label={isRTL ? 'شماره عضویت جدید' : 'New Member Number'}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={memberNumberInput}
            onChange={(e) => handleMemberNumberChange(e.target.value)}
            maxLength={MEMBER_NUMBER_LENGTH}
            error={memberNumberError}
            placeholder={String(target.member_number ?? '')}
          />
          <button
            type="submit"
            disabled={savingMemberNumber || !memberNumberInput.trim() || !!memberNumberError}
            className="self-start flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
            style={{ backgroundColor: '#00ffff', color: '#0a0a0f', boxShadow: '0 0 16px rgba(0,255,255,0.3)' }}
          >
            <Save className="w-4 h-4" />
            {savingMemberNumber ? (isRTL ? 'در حال ذخیره...' : 'Saving...') : (isRTL ? 'ذخیره' : 'Save')}
          </button>
        </form>
      )}

      {canManage && target.is_superuser && !currentMember?.is_superuser && (
        <div className="admin-glass-card p-5 flex items-center gap-3" style={{ border: '1px solid rgba(251,191,36,0.3)' }}>
          <ShieldCheck className="w-5 h-5 flex-shrink-0" style={{ color: '#fbbf24' }} />
          <p className="text-sm text-white/70">
            {isRTL
              ? 'این یک حساب سوپریوزر است. تنها خود سوپریوزر یا سوپریوزرهای دیگر می‌توانند این پروفایل را مشاهده یا ویرایش کنند.'
              : 'This is a superuser account. Only the superuser themselves or another superuser can view or edit this profile.'}
          </p>
        </div>
      )}

      {currentMember?.is_superuser && target.is_superuser && (
        <div className="admin-glass-card p-5 flex items-center gap-3" style={{ border: '1px solid rgba(251,191,36,0.3)' }}>
          <ShieldCheck className="w-5 h-5 flex-shrink-0" style={{ color: '#fbbf24' }} />
          <p className="text-sm text-white/70">
            {isRTL
              ? 'این یک حساب سوپریوزر است. به‌عنوان سوپریوزر می‌توانید پروفایل و رمز عبور این حساب را ویرایش کنید، اما تغییر گروه دسترسی، غیرفعال‌سازی و حذف آن از طریق پنل ادمین همچنان مسدود است.'
              : "This is a superuser account. As a superuser, you can edit this account's profile and password, but changing its access group, deactivating, or deleting it remains blocked from the admin panel."}
          </p>
        </div>
      )}

      {/* Each card below is gated independently on the one permission that
          actually grants it — a viewer holding only one of canManage /
          canChangeAnyPassword / canDeleteOrDeactivate must still reach
          exactly their own card, never blocked by lacking the others. */}
      {(canManage || canChangeAnyPassword || canDeleteOrDeactivate) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile form — can_manage_permissions only; no narrower permission claims this territory */}
        {canManage && (!target.is_superuser || currentMember?.is_superuser) && (
        <form onSubmit={saveProfile} className="admin-glass-card p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-white/80">{isRTL ? 'ویرایش پروفایل' : 'Edit Profile'}</h2>
          <AdminInput
            label={isRTL ? 'نام کامل' : 'Full Name'}
            value={fullName}
            onChange={(e) => handleFullNameChange(e.target.value)}
            maxLength={35}
            error={profileFieldErrors.full_name}
          />
          <AdminInput
            label={isRTL ? 'نام نمایشی' : 'Display Name'}
            value={displayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            maxLength={20}
            error={profileFieldErrors.display_name}
          />
          <AdminInput
            label={isRTL ? 'ایمیل' : 'Email'}
            type="email"
            value={email}
            onChange={(e) => handleProfileEmailChange(e.target.value)}
            maxLength={EMAIL_MAX_LENGTH}
            error={profileFieldErrors.email}
          />
          <AdminInput
            label={isRTL ? 'تلفن' : 'Phone'}
            value={phone}
            onChange={(e) => handleProfilePhoneChange(e.target.value)}
            placeholder={PHONE_PLACEHOLDER}
            maxLength={17}
            error={profileFieldErrors.phone}
          />
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
        )}

        <div className="flex flex-col gap-6">
          {/* Group — can_manage_permissions only; never editable for a superuser target, even by another superuser */}
          {canManage && !target.is_superuser && (
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
          )}

          {/* Password — works independently for a can_change_any_password-only
              viewer, with no need for can_manage_permissions or any other
              member-management permission. */}
          {canChangeAnyPassword && (!target.is_superuser || currentMember?.is_superuser) && (
            <form onSubmit={savePassword} className="admin-glass-card p-5 flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                <KeyRound className="w-4 h-4" style={{ color: '#fbbf24' }} />
                {isRTL ? 'تغییر رمز عبور' : 'Change Password'}
              </h2>
              <div>
                <AdminInput
                  label={isRTL ? 'رمز عبور جدید' : 'New Password'}
                  type="password"
                  value={newPassword}
                  onChange={(e) => handleNewPasswordChange(e.target.value)}
                  error={passwordFieldErrors.new_password}
                  hideMessage
                />
                {newPassword ? (
                  <PasswordRequirementsChecklist isRTL={isRTL} value={newPassword} />
                ) : (
                  <p className="mt-1 text-xs text-white/30">
                    {isRTL
                      ? 'حداقل ۸ نویسه، ترکیبی از حروف و اعداد، شامل حداقل یک حرف بزرگ و یک کاراکتر خاص.'
                      : 'At least 8 characters, with letters and numbers, including one uppercase letter and one special character.'}
                  </p>
                )}
              </div>
              <AdminInput
                label={isRTL ? 'تکرار رمز عبور' : 'Confirm Password'}
                type="password"
                value={confirmPassword}
                onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                error={passwordFieldErrors.confirm_password}
              />
              <button
                type="submit"
                disabled={
                  savingPassword || !newPassword || !confirmPassword ||
                  !!passwordFieldErrors.new_password || !!passwordFieldErrors.confirm_password
                }
                className="self-start flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
                style={{ border: '1px solid #fbbf24', color: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.08)' }}
              >
                {savingPassword ? (isRTL ? 'در حال تغییر...' : 'Changing...') : (isRTL ? 'تغییر رمز' : 'Change Password')}
              </button>
            </form>
          )}

          {/* Danger zone — deactivate/activate works for can_delete_member
              alone too (its own description covers both deactivating and
              removing); delete itself stays narrower (canDelete, matching
              MemberDeleteView). Never available for a superuser target,
              even to another superuser. */}
          {canDeleteOrDeactivate && !target.is_superuser && (
          <div className="admin-glass-card p-5 flex flex-col gap-4" style={{ border: '1px solid rgba(239,68,68,0.25)' }}>
            <h2 className="text-sm font-semibold" style={{ color: '#ef4444' }}>
              {isRTL ? 'منطقه خطر' : 'Danger Zone'}
            </h2>
            {target.is_active === false && (target.deactivation_reason || target.deactivated_by_name) && (
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
          )}
        </div>
      </div>
      )}

      {/* Comments/contributions/contact-messages/activity-log aggregation is
          exclusive to the full-detail tier — a restricted-tier viewer's
          backend response has these as empty arrays by design (not "really
          empty"), so showing four "nothing yet" cards here would actively
          mislead rather than just omit. */}
      {canViewFull && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Comments */}
        <div className="admin-glass-card p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" style={{ color: '#00ffff' }} />
              {isRTL ? 'نظرات' : 'Comments'}
              <span className="text-white/30 text-xs font-normal">({comments.length})</span>
            </h2>
            {comments.length > 0 && (
              <button
                onClick={() => router.push(`/${locale}/admin/comments?member=${id}&name=${encodeURIComponent(target.full_name)}`)}
                className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
                style={{ color: '#00ffff' }}
              >
                {isRTL ? 'مشاهده همه' : 'View all'}
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {comments.length === 0 ? (
              <p className="text-xs text-white/40">{isRTL ? 'نظری ثبت نشده است.' : 'No comments yet.'}</p>
            ) : (
              comments.slice(0, 3).map((c) => (
                <div key={c.id} className="rounded-lg p-3 text-xs flex flex-col gap-1" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white/40">{c.target_label || '—'}</span>
                    <AdminBadge status={c.status} />
                  </div>
                  <p className="text-white/70">{c.text}</p>
                  {c.rating != null && (
                    <p className="text-white/40">{isRTL ? 'امتیاز: ' : 'Rating: '}{c.rating}/5</p>
                  )}
                  {c.status === 'rejected' && c.rejection_reason && (
                    <p style={{ color: '#ef4444' }}>{isRTL ? 'دلیل رد: ' : 'Rejection reason: '}{c.rejection_reason}</p>
                  )}
                  <p className="text-white/30">{new Date(c.created_at).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-US')}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Contributions */}
        <div className="admin-glass-card p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
              <HandCoins className="w-4 h-4" style={{ color: '#10b981' }} />
              {isRTL ? 'مشارکت‌ها' : 'Contributions'}
              <span className="text-white/30 text-xs font-normal">({contributions.length})</span>
            </h2>
            {contributions.length > 0 && (
              <button
                onClick={() => router.push(`/${locale}/admin/contributions?member=${id}&name=${encodeURIComponent(target.full_name)}`)}
                className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
                style={{ color: '#10b981' }}
              >
                {isRTL ? 'مشاهده همه' : 'View all'}
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {contributions.length === 0 ? (
              <p className="text-xs text-white/40">{isRTL ? 'مشارکتی ثبت نشده است.' : 'No contributions yet.'}</p>
            ) : (
              contributions.slice(0, 3).map((c) => (
                <div key={c.id} className="rounded-lg p-3 text-xs flex flex-col gap-1" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white/70 font-medium">{fmt(c.amount)} {c.currency}</span>
                    <AdminBadge status={c.status} />
                  </div>
                  <p className="text-white/40">{c.payment_method}</p>
                  {c.status === 'failed' && c.rejection_reason && (
                    <p style={{ color: '#ef4444' }}>{isRTL ? 'دلیل رد: ' : 'Rejection reason: '}{c.rejection_reason}</p>
                  )}
                  <p className="text-white/30">{new Date(c.created_at).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-US')}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Contact messages */}
        <div className="admin-glass-card p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
              <Mail className="w-4 h-4" style={{ color: '#fbbf24' }} />
              {isRTL ? 'پیام‌های تماس' : 'Contact Messages'}
              <span className="text-white/30 text-xs font-normal">({contactMessages.length})</span>
            </h2>
            {contactMessages.length > 0 && (
              <button
                onClick={() => router.push(`/${locale}/admin/contact-messages?member=${id}&name=${encodeURIComponent(target.full_name)}`)}
                className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
                style={{ color: '#fbbf24' }}
              >
                {isRTL ? 'مشاهده همه' : 'View all'}
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {contactMessages.length === 0 ? (
              <p className="text-xs text-white/40">{isRTL ? 'پیامی ثبت نشده است.' : 'No contact messages yet.'}</p>
            ) : (
              contactMessages.slice(0, 3).map((m) => (
                <div key={m.id} className="rounded-lg p-3 text-xs flex flex-col gap-1" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white/40">{m.contact_info}</span>
                    <AdminBadge
                      status={m.is_handled ? 'completed' : 'pending'}
                      label={m.is_handled ? (isRTL ? 'رسیدگی‌شده' : 'Handled') : (isRTL ? 'در انتظار' : 'Pending')}
                    />
                  </div>
                  <p className="text-white/70">{m.message}</p>
                  <p className="text-white/30">{new Date(m.created_at).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-US')}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Activity log */}
        <div className="admin-glass-card p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
              <ScrollText className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              {isRTL ? 'گزارش فعالیت' : 'Activity Log'}
              <span className="text-white/30 text-xs font-normal">({activityLogs.length})</span>
            </h2>
            {activityLogs.length > 0 && (
              <button
                onClick={() => router.push(`/${locale}/admin/logs/activity?member=${id}&name=${encodeURIComponent(target.full_name)}`)}
                className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
                style={{ color: '#8b5cf6' }}
              >
                {isRTL ? 'مشاهده همه' : 'View all'}
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {activityLogs.length === 0 ? (
              <p className="text-xs text-white/40">{isRTL ? 'فعالیتی ثبت نشده است.' : 'No activity yet.'}</p>
            ) : (
              activityLogs.slice(0, 3).map((l) => (
                <div key={l.id} className="rounded-lg p-3 text-xs flex flex-col gap-1" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-white/70 font-medium">{l.action.replace(/_/g, ' ')}</span>
                  {l.target_display && <span className="text-white/40">{l.target_display}</span>}
                  <p className="text-white/30">{new Date(l.created_at).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      )}

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
            maxLength={LONG_TEXT_ADMIN_MAX_LENGTH}
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
