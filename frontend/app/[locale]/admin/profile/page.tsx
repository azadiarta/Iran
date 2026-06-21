'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Save, KeyRound, ShieldCheck } from 'lucide-react';
import AdminInput from '@/components/admin/fields/AdminInput';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { membersAPI } from '@/lib/api';
import {
  isValidPhoneStrict,
  isValidEmail,
  phoneFormatError,
  passwordStrengthError,
  passwordMismatchError,
  PHONE_PLACEHOLDER,
  EMAIL_MAX_LENGTH,
} from '@/lib/validation';

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AdminProfilePage() {
  const params = useParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const { member, setMember } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [originalPhone, setOriginalPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<{ new_password?: string; confirm_password?: string }>({});

  useEffect(() => {
    if (member) {
      setFullName(member.full_name || '');
      setDisplayName(member.display_name || '');
      setEmail(member.email || '');
      setPhone(member.phone || '');
      setOriginalPhone(member.phone || '');
    }
  }, [member]);

  if (!member) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'در حال بارگذاری...' : 'Loading...'}
      </div>
    );
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    if (fullName.trim().length > 35) {
      showToast('warning', isRTL ? 'نام کامل باید حداکثر ۳۵ نویسه باشد' : 'Full name must be 35 characters or fewer');
      return;
    }
    if (displayName.trim().length > 20) {
      showToast('warning', isRTL ? 'نام نمایشی باید حداکثر ۲۰ نویسه باشد' : 'Display name must be 20 characters or fewer');
      return;
    }
    if (email.trim() && !isValidEmail(email)) {
      showToast('warning', isRTL ? 'ایمیل وارد شده معتبر نیست' : 'Enter a valid email address');
      return;
    }
    if (phone.trim() && phone.trim() !== originalPhone && !isValidPhoneStrict(phone)) {
      showToast('warning', phoneFormatError(isRTL));
      return;
    }
    setSavingProfile(true);
    try {
      const res = await membersAPI.updateProfile(member.id, { full_name: fullName, display_name: displayName, email, phone });
      setMember(res.data as unknown as typeof member);
      setOriginalPhone(phone.trim());
      showToast('success', isRTL ? 'پروفایل با موفقیت به‌روزرسانی شد' : 'Profile updated successfully');
    } catch {
      showToast('error', isRTL ? 'به‌روزرسانی پروفایل ناموفق بود' : 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  }

  function handleNewPasswordChange(value: string) {
    setNewPassword(value);
    setPasswordFieldErrors((prev) => ({
      ...prev,
      new_password: passwordStrengthError(isRTL, value),
      confirm_password: confirmPassword && value !== confirmPassword ? passwordMismatchError(isRTL) : undefined,
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
    if (!member) return;
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
      await membersAPI.changePassword(member.id, {
        old_password: oldPassword || undefined,
        new_password: newPassword,
        confirm_new_password: confirmPassword,
      });
      showToast('success', isRTL ? 'رمز عبور با موفقیت تغییر کرد' : 'Password changed successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordFieldErrors({});
    } catch {
      showToast('error', isRTL ? 'تغییر رمز عبور ناموفق بود' : 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-white">{isRTL ? 'پروفایل من' : 'My Profile'}</h1>
        <p className="text-sm text-white/40 mt-1">{isRTL ? 'مشاهده و ویرایش اطلاعات حساب کاربری شما' : 'View and edit your account information'}</p>
      </div>

      <div className="admin-glass-card p-5 flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-2 select-none flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(0,255,255,0.2) 0%, rgba(139,92,246,0.2) 100%)',
            borderColor: '#00ffff',
            boxShadow: '0 0 16px rgba(0,255,255,0.3)',
            color: '#00ffff',
          }}
        >
          {getInitials(member.full_name)}
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">{member.full_name}</h2>
          <p className="text-sm text-white/50 mt-0.5">
            @{member.display_name} · #{member.member_number}
          </p>
          <p className="text-xs mt-1">
            {member.is_superuser ? (
              <span className="font-bold" style={{ color: '#fbbf24' }}>{isRTL ? 'سوپریوزر' : 'Superuser'}</span>
            ) : (
              <span className="text-white/40">{member.group_name || '—'}</span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={saveProfile} className="admin-glass-card p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-white/80">{isRTL ? 'ویرایش پروفایل' : 'Edit Profile'}</h2>
          <AdminInput label={isRTL ? 'نام کامل' : 'Full Name'} value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={35} />
          <AdminInput label={isRTL ? 'نام نمایشی' : 'Display Name'} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={20} />
          <AdminInput label={isRTL ? 'ایمیل' : 'Email'} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={EMAIL_MAX_LENGTH} />
          <AdminInput
            label={isRTL ? 'تلفن' : 'Phone'}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={PHONE_PLACEHOLDER}
            maxLength={17}
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

        <form onSubmit={savePassword} className="admin-glass-card p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
            <KeyRound className="w-4 h-4" style={{ color: '#fbbf24' }} />
            {isRTL ? 'تغییر رمز عبور' : 'Change Password'}
          </h2>
          <AdminInput
            label={isRTL ? 'رمز عبور فعلی' : 'Current Password'}
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
          <AdminInput
            label={isRTL ? 'رمز عبور جدید' : 'New Password'}
            type="password"
            value={newPassword}
            onChange={(e) => handleNewPasswordChange(e.target.value)}
            error={passwordFieldErrors.new_password}
            hint={
              isRTL
                ? 'حداقل ۸ نویسه، ترکیبی از حروف و اعداد، شامل حداقل یک حرف بزرگ و یک کاراکتر خاص.'
                : 'At least 8 characters, with letters and numbers, including one uppercase letter and one special character.'
            }
          />
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
      </div>

      {member.is_superuser && (
        <div className="admin-glass-card p-5 flex items-center gap-3" style={{ border: '1px solid rgba(251,191,36,0.3)' }}>
          <ShieldCheck className="w-5 h-5 flex-shrink-0" style={{ color: '#fbbf24' }} />
          <p className="text-sm text-white/70">
            {isRTL
              ? 'برای تغییر گروه دسترسی یا شماره عضویت خود، از صفحه «اعضا» در پنل ادمین استفاده کنید.'
              : 'To change your access group or member number, use the Members page in the admin panel.'}
          </p>
        </div>
      )}
    </div>
  );
}
