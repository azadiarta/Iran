'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Eye, Plus } from 'lucide-react';
import AdminTable, { AdminTableColumn } from '@/components/admin/AdminTable';
import AdminBadge from '@/components/admin/AdminBadge';
import AdminModal from '@/components/admin/AdminModal';
import AdminInput from '@/components/admin/fields/AdminInput';
import AdminSelect from '@/components/admin/fields/AdminSelect';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { membersAPI, groupsAPI, MemberListItem, AccessGroup, Paginated } from '@/lib/api';
import {
  isValidPhoneStrict,
  isValidEmail,
  phoneFormatError,
  emailFormatError,
  passwordStrengthError,
  passwordMismatchError,
  requiredFieldError,
  PHONE_PLACEHOLDER,
  EMAIL_MAX_LENGTH,
} from '@/lib/validation';

interface CreateFieldErrors {
  phone?: string;
  email?: string;
  password?: string;
  password_confirm?: string;
}

export default function AdminMembersPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const { hasPermission, member: currentMember } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const canManage = !!currentMember?.is_superuser || hasPermission('can_manage_permissions');
  // Three independent tiers, matching the backend's serializer branching
  // (accounts.member_views): full detail, delete/deactivate-only minimal
  // (adds is_active), or bare name+ID minimal. Each works standalone.
  const canViewFull = canManage || hasPermission('can_view_member_details');
  const canDeleteOrDeactivate = canManage || hasPermission('can_delete_member');
  const canChangeAnyPassword = !!currentMember?.is_superuser || hasPermission('can_change_any_password');
  const canView = canViewFull || canDeleteOrDeactivate || canChangeAnyPassword;

  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 5;
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [newGroupId, setNewGroupId] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<CreateFieldErrors>({});

  useEffect(() => {
    // Fetching the group list itself requires can_manage_permissions; a
    // restricted viewer (can_change_any_password/can_delete_member-only)
    // can't create members anyway, so skip the call entirely for them.
    if (!canManage) return;
    groupsAPI
      .getList()
      .then((res) => setGroups(res.data as unknown as AccessGroup[]))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  function load() {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const filters: { search?: string; group?: string; is_active?: boolean } = {};
    if (search) filters.search = search;
    if (groupFilter) filters.group = groupFilter;
    if (activeFilter) filters.is_active = activeFilter === 'active';

    membersAPI
      .getList(page, filters)
      .then((res) => {
        const data = res.data as unknown as Paginated<MemberListItem>;
        setMembers(data.results);
        setHasNext(!!data.next);
        setTotalCount(data.count);
      })
      .catch(() => showToast('error', isRTL ? 'بارگذاری اعضا ناموفق بود' : 'Failed to load members'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, page, search, groupFilter, activeFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  function openCreate() {
    setFullName('');
    setDisplayName('');
    setPhone('');
    setEmail('');
    setNewGroupId('');
    setPassword('');
    setPasswordConfirm('');
    setFieldErrors({});
    setModalOpen(true);
  }

  function handlePhoneChange(value: string) {
    setPhone(value);
    setFieldErrors((prev) => ({
      ...prev,
      phone: value.trim() && !isValidPhoneStrict(value) ? phoneFormatError(isRTL) : undefined,
      // Typing a phone satisfies "at least one of phone or email" — clear a
      // stale required-error on email if it was only there for that reason.
      email: prev.email === requiredFieldError(isRTL) ? undefined : prev.email,
    }));
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    setFieldErrors((prev) => ({
      ...prev,
      email: value.trim() && !isValidEmail(value) ? emailFormatError(isRTL) : undefined,
      phone: prev.phone === requiredFieldError(isRTL) ? undefined : prev.phone,
    }));
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    setFieldErrors((prev) => ({
      ...prev,
      password: passwordStrengthError(isRTL, value),
      password_confirm:
        passwordConfirm && value !== passwordConfirm ? passwordMismatchError(isRTL) : undefined,
    }));
  }

  function handlePasswordConfirmChange(value: string) {
    setPasswordConfirm(value);
    setFieldErrors((prev) => ({
      ...prev,
      password_confirm: value && value !== password ? passwordMismatchError(isRTL) : undefined,
    }));
  }

  function validateCreate(): boolean {
    const errors: CreateFieldErrors = {};
    if (!phone.trim() && !email.trim()) {
      errors.phone = requiredFieldError(isRTL);
      errors.email = requiredFieldError(isRTL);
    }
    if (phone.trim() && !isValidPhoneStrict(phone)) {
      errors.phone = phoneFormatError(isRTL);
    }
    if (email.trim() && !isValidEmail(email)) {
      errors.email = emailFormatError(isRTL);
    }
    const passwordError = passwordStrengthError(isRTL, password);
    if (passwordError) errors.password = passwordError;
    if (password !== passwordConfirm) {
      errors.password_confirm = passwordMismatchError(isRTL);
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!validateCreate()) return;
    setSaving(true);
    try {
      await membersAPI.create({
        full_name: fullName,
        display_name: displayName || undefined,
        phone: phone || undefined,
        email: email || undefined,
        password,
        password_confirm: passwordConfirm,
        group_id: newGroupId || undefined,
      });
      showToast('success', isRTL ? 'عضو با موفقیت ایجاد شد' : 'Member created successfully');
      setModalOpen(false);
      load();
    } catch {
      showToast('error', isRTL ? 'ایجاد عضو ناموفق بود' : 'Failed to create member');
    } finally {
      setSaving(false);
    }
  }

  if (!canView) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'شما دسترسی مشاهده اعضا را ندارید.' : 'You do not have permission to view members.'}
      </div>
    );
  }

  // Three independent column sets, matching the backend's serializer tiers:
  // a restricted viewer's rows simply don't carry display_name/group_name/
  // is_active/created_at, so those columns must not be rendered for them —
  // showing "Invalid Date" or a blank cell would leak the absence as a bug
  // rather than as the deliberate minimal payload it is.
  const idColumn: AdminTableColumn<MemberListItem> = {
    key: 'full_name',
    header: isRTL ? 'نام کامل' : 'Full Name',
    render: (m) => <span className="text-white/80">{m.full_name}</span>,
  };
  const memberNumberColumn: AdminTableColumn<MemberListItem> = {
    key: 'member_number',
    header: isRTL ? 'شناسه' : 'ID',
    render: (m) => <span className="text-white/40 text-xs font-mono">#{m.member_number}</span>,
  };
  const actionsColumn: AdminTableColumn<MemberListItem> = {
    key: 'actions',
    header: '',
    render: (m) =>
      m.is_superuser && !currentMember?.is_superuser ? (
        <span className="text-xs text-white/30">{isRTL ? 'محدود شده' : 'Restricted'}</span>
      ) : (
        <button
          onClick={() => router.push(`/${locale}/admin/members/${m.id}`)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
          style={{ border: '1px solid rgba(0,255,255,0.3)', color: '#00ffff', backgroundColor: 'rgba(0,255,255,0.05)' }}
        >
          <Eye className="w-3.5 h-3.5" />
          {isRTL ? 'مشاهده' : 'View'}
        </button>
      ),
  };

  let columns: AdminTableColumn<MemberListItem>[];
  if (canViewFull) {
    columns = [
      idColumn,
      { key: 'display_name', header: isRTL ? 'نام نمایشی' : 'Display Name', render: (m) => <span className="text-white/60">{m.display_name}</span> },
      memberNumberColumn,
      {
        key: 'group',
        header: isRTL ? 'گروه' : 'Group',
        render: (m) =>
          m.is_superuser ? (
            <span className="text-xs font-bold" style={{ color: '#fbbf24' }}>{isRTL ? 'سوپریوزر' : 'Superuser'}</span>
          ) : (
            <span className="text-white/60">{m.group_name || '—'}</span>
          ),
      },
      { key: 'status', header: isRTL ? 'وضعیت' : 'Status', render: (m) => <AdminBadge status={m.is_active ? 'active' : 'inactive'} /> },
      {
        key: 'created_at',
        header: isRTL ? 'تاریخ عضویت' : 'Joined',
        render: (m) => <span className="text-white/40 text-xs">{m.created_at ? new Date(m.created_at).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-US') : '—'}</span>,
      },
      actionsColumn,
    ];
  } else if (canDeleteOrDeactivate) {
    columns = [
      idColumn,
      memberNumberColumn,
      { key: 'status', header: isRTL ? 'وضعیت' : 'Status', render: (m) => <AdminBadge status={m.is_active ? 'active' : 'inactive'} /> },
      actionsColumn,
    ];
  } else {
    columns = [idColumn, memberNumberColumn, actionsColumn];
  }

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{isRTL ? 'اعضا' : 'Members'}</h1>
          <p className="text-sm text-white/40 mt-1">{isRTL ? 'مدیریت اعضای سامانه' : 'Manage system members'}</p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all"
            style={{ backgroundColor: '#00ffff', color: '#0a0a0f', boxShadow: '0 0 16px rgba(0,255,255,0.3)' }}
          >
            <Plus className="w-4 h-4" />
            {isRTL ? 'افزودن عضو' : 'Add Member'}
          </button>
        )}
      </div>

      <div className="admin-glass-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="lg:col-span-2">
          <AdminInput
            placeholder={isRTL ? 'جستجو بر اساس نام یا شناسه...' : 'Search by name or ID...'}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            maxLength={150}
          />
        </div>
        {/* Group names aren't part of a restricted viewer's payload (and the
            group list itself isn't fetched for them), so this filter is
            meaningless outside the full-detail tier. */}
        {canManage && (
          <AdminSelect
            value={groupFilter}
            onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }}
            options={[
              { value: '', label: isRTL ? 'همه گروه‌ها' : 'All groups' },
              ...groups.map((g) => ({ value: g.id, label: g.name })),
            ]}
          />
        )}
        {/* is_active is only present for canViewFull/canDeleteOrDeactivate
            tiers — a can_change_any_password-only viewer never sees it. */}
        {(canViewFull || canDeleteOrDeactivate) && (
          <AdminSelect
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
            options={[
              { value: '', label: isRTL ? 'همه وضعیت‌ها' : 'All statuses' },
              { value: 'active', label: isRTL ? 'فعال' : 'Active' },
              { value: 'inactive', label: isRTL ? 'غیرفعال' : 'Inactive' },
            ]}
          />
        )}
      </div>

      <AdminTable
        columns={columns}
        data={members}
        loading={loading}
        rowKey={(m) => m.id}
        emptyMessage={isRTL ? 'عضوی یافت نشد' : 'No members found'}
        pagination={{
          page,
          hasNext,
          hasPrev: page > 1,
          onPageChange: setPage,
          prevLabel: isRTL ? 'قبلی' : 'Prev',
          nextLabel: isRTL ? 'بعدی' : 'Next',
          pageLabel: isRTL
            ? `صفحه ${page} از ${Math.max(1, Math.ceil(totalCount / pageSize))}`
            : `Page ${page} of ${Math.max(1, Math.ceil(totalCount / pageSize))}`,
        }}
      />

      <AdminModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={isRTL ? 'افزودن عضو' : 'Add Member'}>
        <form onSubmit={submitCreate} className="flex flex-col gap-4">
          <AdminInput label={isRTL ? 'نام کامل' : 'Full Name'} value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={35} />
          <AdminInput label={isRTL ? 'نام نمایشی (اختیاری)' : 'Display Name (optional)'} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={20} />
          <AdminInput
            label={isRTL ? 'تلفن (اختیاری)' : 'Phone (optional)'}
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder={PHONE_PLACEHOLDER}
            maxLength={17}
            error={fieldErrors.phone}
          />
          <AdminInput
            label={isRTL ? 'ایمیل (اختیاری)' : 'Email (optional)'}
            type="email"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            maxLength={EMAIL_MAX_LENGTH}
            error={fieldErrors.email}
          />
          <AdminSelect
            label={isRTL ? 'گروه دسترسی' : 'Access Group'}
            value={newGroupId}
            onChange={(e) => setNewGroupId(e.target.value)}
            options={groups.map((g) => ({ value: g.id, label: g.name }))}
            placeholder={isRTL ? 'پیش‌فرض' : 'Default'}
          />
          <AdminInput
            label={isRTL ? 'رمز عبور' : 'Password'}
            type="password"
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            required
            error={fieldErrors.password}
            hint={
              isRTL
                ? 'حداقل ۸ نویسه، ترکیبی از حروف و اعداد، شامل حداقل یک حرف بزرگ و یک کاراکتر خاص.'
                : 'At least 8 characters, with letters and numbers, including one uppercase letter and one special character.'
            }
          />
          <AdminInput
            label={isRTL ? 'تکرار رمز عبور' : 'Confirm Password'}
            type="password"
            value={passwordConfirm}
            onChange={(e) => handlePasswordConfirmChange(e.target.value)}
            required
            error={fieldErrors.password_confirm}
          />
          <div className="flex items-center gap-3 mt-1">
            <button
              type="submit"
              disabled={saving || !fullName.trim() || !password || !passwordConfirm}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
              style={{ backgroundColor: '#00ffff', color: '#0a0a0f', boxShadow: '0 0 16px rgba(0,255,255,0.3)' }}
            >
              {saving ? (isRTL ? 'در حال ایجاد...' : 'Creating...') : (isRTL ? 'ایجاد عضو' : 'Create Member')}
            </button>
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl px-5 py-2.5 text-sm font-medium text-white/60 hover:text-white/90 transition-colors">
              {isRTL ? 'انصراف' : 'Cancel'}
            </button>
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
