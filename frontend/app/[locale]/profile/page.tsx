'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { User, Edit2, Save, X, Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import { membersAPI } from '@/lib/api';
import useAuthStore from '@/store/authStore';
import type { Member } from '@/store/authStore';

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(dateStr: string, locale: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function ProfilePage() {
  const t = useTranslations('profile');
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';
  const { member, isAuthenticated, setMember } = useAuthStore();

  // ── Edit profile state ───────────────────────────────────────────────────
  const [showEditForm, setShowEditForm] = useState(false);
  const [editData, setEditData] = useState({
    full_name: '',
    display_name: '',
    email: '',
    phone: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});

  // ── Change password state ────────────────────────────────────────────────
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_new_password: '',
  });
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // ── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/${locale}/login`);
    }
  }, [isAuthenticated, locale, router]);

  // Pre-fill edit form when member loads
  useEffect(() => {
    if (member) {
      setEditData({
        full_name: member.full_name || '',
        display_name: member.display_name || '',
        email: member.email || '',
        phone: member.phone || '',
      });
    }
  }, [member]);

  if (!isAuthenticated || !member) {
    return null;
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleEditToggle = () => {
    setShowEditForm((v) => !v);
    setEditSuccess(false);
    setEditError(null);
    setEditFieldErrors({});
    if (member) {
      setEditData({
        full_name: member.full_name || '',
        display_name: member.display_name || '',
        email: member.email || '',
        phone: member.phone || '',
      });
    }
  };

  const handleEditSave = async () => {
    if (!member) return;
    setEditSaving(true);
    setEditError(null);
    setEditFieldErrors({});
    setEditSuccess(false);
    try {
      const res = await membersAPI.updateProfile(member.id, {
        full_name: editData.full_name || undefined,
        display_name: editData.display_name || undefined,
        email: editData.email || undefined,
        phone: editData.phone || undefined,
      });
      const updated = res.data as unknown as Member;
      setMember(updated);
      setEditSuccess(true);
      setShowEditForm(false);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: Record<string, string | string[]> };
      };
      const responseData = axiosErr?.response?.data;
      if (responseData) {
        const fieldErrs: Record<string, string> = {};
        let hasFieldErr = false;
        for (const [key, val] of Object.entries(responseData)) {
          if (['full_name', 'display_name', 'email', 'phone'].includes(key)) {
            fieldErrs[key] = Array.isArray(val) ? val[0] : String(val);
            hasFieldErr = true;
          }
        }
        if (hasFieldErr) {
          setEditFieldErrors(fieldErrs);
        } else {
          const msg =
            typeof responseData === 'object' && 'message' in responseData
              ? String(responseData.message)
              : t('save_error');
          setEditError(msg);
        }
      } else {
        setEditError(t('save_error'));
      }
    } finally {
      setEditSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!member) return;
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(false);
    try {
      await membersAPI.changePassword(member.id, {
        old_password: passwordData.old_password || undefined,
        new_password: passwordData.new_password,
        confirm_new_password: passwordData.confirm_new_password,
      });
      setPasswordSuccess(true);
      setPasswordData({ old_password: '', new_password: '', confirm_new_password: '' });
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string; detail?: string } };
      };
      const msg =
        axiosErr?.response?.data?.message ||
        axiosErr?.response?.data?.detail ||
        t('password_error');
      setPasswordError(msg);
    } finally {
      setPasswordSaving(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 outline-none focus:border-[#00ffff] focus:ring-1 focus:ring-[#00ffff]/30 transition-all';

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Avatar & identity section */}
        <div className="flex flex-col items-center gap-4 mb-10">
          {/* Avatar circle */}
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold border-2 select-none"
            style={{
              background: 'linear-gradient(135deg, rgba(0,255,255,0.2) 0%, rgba(139,92,246,0.2) 100%)',
              borderColor: '#00ffff',
              boxShadow: '0 0 24px rgba(0,255,255,0.3), 0 0 48px rgba(0,255,255,0.1)',
              color: '#00ffff',
            }}
          >
            {getInitials(member.full_name)}
          </div>

          {/* Name */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">{member.full_name}</h1>
            <p
              className="text-base mt-1"
              style={{ color: '#00ffff' }}
            >
              @{member.display_name}
            </p>
          </div>

          {/* Group badge */}
          {member.group_name && (
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold border"
              style={{
                borderColor: 'rgba(139,92,246,0.4)',
                backgroundColor: 'rgba(139,92,246,0.1)',
                color: '#8b5cf6',
              }}
            >
              {member.group_name}
            </span>
          )}

          {/* Joined date */}
          {member.created_at && (
            <p className="text-xs text-white/40">
              {t('joined')} {formatDate(member.created_at, locale)}
            </p>
          )}
        </div>

        {/* Edit profile section */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-white/50" />
              {t('edit_profile')}
            </h2>
            <button
              onClick={handleEditToggle}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all border"
              style={{
                borderColor: showEditForm ? 'rgba(239,68,68,0.4)' : 'rgba(0,255,255,0.3)',
                color: showEditForm ? '#ef4444' : '#00ffff',
                backgroundColor: showEditForm ? 'rgba(239,68,68,0.1)' : 'rgba(0,255,255,0.05)',
              }}
            >
              {showEditForm ? (
                <><X className="w-3.5 h-3.5" /> {t('cancel')}</>
              ) : (
                <><Edit2 className="w-3.5 h-3.5" /> {t('edit')}</>
              )}
            </button>
          </div>

          {/* Success message */}
          {editSuccess && (
            <div className="flex items-center gap-2 rounded-xl border border-[#10b981]/30 bg-[#10b981]/10 p-3 mb-4">
              <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#10b981' }} />
              <p className="text-sm" style={{ color: '#10b981' }}>{t('profile_updated')}</p>
            </div>
          )}

          {/* Edit form */}
          {showEditForm ? (
            <div className="space-y-4">
              {/* Full name */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">{t('full_name')}</label>
                <input
                  type="text"
                  value={editData.full_name}
                  onChange={(e) => setEditData((d) => ({ ...d, full_name: e.target.value }))}
                  className={inputClass}
                />
                {editFieldErrors.full_name && (
                  <p className="text-xs text-[#ef4444] mt-1">{editFieldErrors.full_name}</p>
                )}
              </div>

              {/* Display name */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">{t('display_name')}</label>
                <input
                  type="text"
                  value={editData.display_name}
                  onChange={(e) => setEditData((d) => ({ ...d, display_name: e.target.value }))}
                  className={inputClass}
                />
                {editFieldErrors.display_name && (
                  <p className="text-xs text-[#ef4444] mt-1">{editFieldErrors.display_name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">{t('email')}</label>
                <input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData((d) => ({ ...d, email: e.target.value }))}
                  className={inputClass}
                />
                {editFieldErrors.email && (
                  <p className="text-xs text-[#ef4444] mt-1">{editFieldErrors.email}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">{t('phone')}</label>
                <input
                  type="tel"
                  value={editData.phone}
                  onChange={(e) => setEditData((d) => ({ ...d, phone: e.target.value }))}
                  className={inputClass}
                />
                {editFieldErrors.phone && (
                  <p className="text-xs text-[#ef4444] mt-1">{editFieldErrors.phone}</p>
                )}
              </div>

              {/* General error */}
              {editError && (
                <div className="flex items-start gap-2 rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                  <p className="text-sm" style={{ color: '#ef4444' }}>{editError}</p>
                </div>
              )}

              {/* Save / Cancel */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleEditToggle}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm transition-all"
                >
                  <X className="w-4 h-4" />
                  {t('cancel')}
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: '#00ffff',
                    color: '#0a0a0f',
                    boxShadow: '0 0 20px rgba(0,255,255,0.3)',
                  }}
                >
                  {editSaving ? (
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Save className="w-4 h-4" /> {t('save')}</>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Read-only view */
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-xs text-white/40">{t('full_name')}</span>
                <span className="text-sm text-white font-medium">{member.full_name}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-xs text-white/40">{t('display_name')}</span>
                <span className="text-sm" style={{ color: '#00ffff' }}>@{member.display_name}</span>
              </div>
              {member.email && (
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-xs text-white/40">{t('email')}</span>
                  <span className="text-sm text-white/80">{member.email}</span>
                </div>
              )}
              {member.phone && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-white/40">{t('phone')}</span>
                  <span className="text-sm text-white/80">{member.phone}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Change password section */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <button
            onClick={() => {
              setShowPasswordSection((v) => !v);
              setPasswordSuccess(false);
              setPasswordError(null);
            }}
            className="w-full flex items-center justify-between"
          >
            <h2 className="font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-white/50" />
              {t('change_password')}
            </h2>
            <span className="text-white/40 text-sm">
              {showPasswordSection ? '▲' : '▼'}
            </span>
          </button>

          {showPasswordSection && (
            <div className="mt-5 space-y-4">
              {/* Success */}
              {passwordSuccess && (
                <div className="flex items-center gap-2 rounded-xl border border-[#10b981]/30 bg-[#10b981]/10 p-3">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#10b981' }} />
                  <p className="text-sm" style={{ color: '#10b981' }}>{t('password_changed')}</p>
                </div>
              )}

              {/* Old password */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">{t('old_password')}</label>
                <div className="relative">
                  <input
                    type={showOldPw ? 'text' : 'password'}
                    value={passwordData.old_password}
                    onChange={(e) =>
                      setPasswordData((d) => ({ ...d, old_password: e.target.value }))
                    }
                    className={inputClass + ' pr-11'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showOldPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">{t('new_password')}</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={passwordData.new_password}
                    onChange={(e) =>
                      setPasswordData((d) => ({ ...d, new_password: e.target.value }))
                    }
                    className={inputClass + ' pr-11'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm new password */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  {t('confirm_new_password')}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    value={passwordData.confirm_new_password}
                    onChange={(e) =>
                      setPasswordData((d) => ({ ...d, confirm_new_password: e.target.value }))
                    }
                    className={inputClass + ' pr-11'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* General error */}
              {passwordError && (
                <div className="flex items-start gap-2 rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                  <p className="text-sm" style={{ color: '#ef4444' }}>{passwordError}</p>
                </div>
              )}

              {/* Save button */}
              <button
                onClick={handlePasswordSave}
                disabled={
                  passwordSaving ||
                  !passwordData.new_password ||
                  !passwordData.confirm_new_password
                }
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#00ffff',
                  color: '#0a0a0f',
                  boxShadow: '0 0 20px rgba(0,255,255,0.3)',
                }}
              >
                {passwordSaving ? (
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><Save className="w-4 h-4" /> {t('save_password')}</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
