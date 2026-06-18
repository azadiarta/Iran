'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Check, X, Trash2, Plus, Eye, Pencil } from 'lucide-react';
import AdminTable, { AdminTableColumn } from '@/components/admin/AdminTable';
import AdminBadge from '@/components/admin/AdminBadge';
import AdminModal from '@/components/admin/AdminModal';
import AdminSelect from '@/components/admin/fields/AdminSelect';
import AdminInput from '@/components/admin/fields/AdminInput';
import AdminTextarea from '@/components/admin/fields/AdminTextarea';
import AdminToggle from '@/components/admin/fields/AdminToggle';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';
import ImageLightbox from '@/components/common/ImageLightbox';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { fundAPI, Contribution, ContributionDisplayNameChoice, Paginated } from '@/lib/api';
import { SETTINGS_META } from '@/lib/settingsMeta';
import { PAYMENT_METHOD_LABELS, getPaymentMethodLabel } from '@/lib/paymentMethodsMeta';

const STATUS_OPTIONS_BIDIRECTIONAL = (isRTL: boolean) => [
  { value: 'pending', label: isRTL ? 'در انتظار' : 'Pending' },
  { value: 'pending_review', label: isRTL ? 'در انتظار بررسی' : 'Pending Review' },
  { value: 'completed', label: isRTL ? 'تکمیل شده' : 'Completed' },
  { value: 'failed', label: isRTL ? 'رد شده' : 'Rejected' },
];

const DISPLAY_NAME_CHOICE_OPTIONS = (isRTL: boolean) => [
  { value: 'hidden', label: isRTL ? 'پنهان' : 'Hidden' },
  { value: 'display_name', label: isRTL ? 'نام نمایشی' : 'Display Name' },
  { value: 'full_name', label: isRTL ? 'نام کامل' : 'Full Name' },
  { value: 'custom', label: isRTL ? 'نام دلخواه' : 'Custom' },
];

type ConfirmAction = { type: 'approve' | 'reject' | 'delete'; contribution: Contribution } | null;

export default function AdminContributionsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const { hasPermission, member: currentMember } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const canView = !!currentMember?.is_superuser || hasPermission('can_view_balance');
  const canManage = !!currentMember?.is_superuser || hasPermission('can_manage_permissions');
  const isSuperuser = !!currentMember?.is_superuser;

  const [items, setItems] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 5;
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [memberFilterId, setMemberFilterId] = useState(searchParams.get('member') || '');
  const [memberFilterName, setMemberFilterName] = useState(searchParams.get('name') || '');

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [paymentMethod, setPaymentMethod] = useState('manual');
  const [status, setStatus] = useState('completed');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Details modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Contribution | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailActionLoading, setDetailActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editCurrency, setEditCurrency] = useState('GBP');
  const [editGuestName, setEditGuestName] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('manual');
  const [editStatus, setEditStatus] = useState('pending');
  const [editNotes, setEditNotes] = useState('');
  const [editRejectionReason, setEditRejectionReason] = useState('');
  const [editShowInPublicList, setEditShowInPublicList] = useState(false);
  const [editDisplayNameChoice, setEditDisplayNameChoice] = useState<ContributionDisplayNameChoice>('display_name');
  const [editPublicDisplayName, setEditPublicDisplayName] = useState('');
  const [editMessage, setEditMessage] = useState('');

  function load() {
    setLoading(true);
    const filters: { status?: string; payment_method?: string; contributor?: string } = {};
    if (statusFilter) filters.status = statusFilter;
    if (methodFilter) filters.payment_method = methodFilter;
    if (memberFilterId) filters.contributor = memberFilterId;
    fundAPI
      .getContributions(page, filters)
      .then((res) => {
        const data = res.data as unknown as Paginated<Contribution>;
        setItems(data.results);
        setHasNext(!!data.next);
        setTotalCount(data.count);
      })
      .catch(() => showToast('error', isRTL ? 'بارگذاری مشارکت‌ها ناموفق بود' : 'Failed to load contributions'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (canView) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, page, statusFilter, methodFilter, memberFilterId]);

  function clearMemberFilter() {
    setMemberFilterId('');
    setMemberFilterName('');
    setPage(1);
    router.replace(`/${locale}/admin/contributions`);
  }

  async function runAction() {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction.type === 'approve') {
        await fundAPI.updateContributionStatus(confirmAction.contribution.id, 'completed');
        showToast('success', isRTL ? 'مشارکت تأیید شد' : 'Contribution approved');
      } else if (confirmAction.type === 'reject') {
        await fundAPI.updateContributionStatus(confirmAction.contribution.id, 'failed');
        showToast('success', isRTL ? 'مشارکت رد شد' : 'Contribution rejected');
      } else {
        await fundAPI.deleteContribution(confirmAction.contribution.id);
        showToast('success', isRTL ? 'مشارکت حذف شد' : 'Contribution deleted');
      }
      setConfirmAction(null);
      load();
    } catch {
      showToast('error', isRTL ? 'انجام عملیات ناموفق بود' : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  function openCreate() {
    setGuestName('');
    setAmount('');
    setCurrency('GBP');
    setPaymentMethod('manual');
    setStatus('completed');
    setNotes('');
    setModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) {
      showToast('warning', isRTL ? 'نام مشارکت‌کننده را وارد کنید' : 'Enter the contributor name');
      return;
    }
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      showToast('warning', isRTL ? 'مبلغ معتبر وارد کنید' : 'Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      await fundAPI.createManualContribution({
        guest_name: guestName,
        amount: amountNum,
        currency,
        payment_method: paymentMethod,
        status,
        notes: notes || undefined,
      });
      showToast('success', isRTL ? 'مشارکت با موفقیت ثبت شد' : 'Contribution recorded successfully');
      setModalOpen(false);
      load();
    } catch {
      showToast('error', isRTL ? 'ثبت مشارکت ناموفق بود' : 'Failed to record contribution');
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(c: Contribution) {
    setDetailModalOpen(true);
    setDetailLoading(true);
    setDetailItem(null);
    setRejectReason('');
    try {
      const res = await fundAPI.getContributionDetail(c.id);
      setDetailItem(res.data as unknown as Contribution);
    } catch {
      showToast('error', isRTL ? 'بارگذاری جزئیات ناموفق بود' : 'Failed to load details');
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  async function approveFromDetail() {
    if (!detailItem) return;
    setDetailActionLoading(true);
    try {
      await fundAPI.updateContributionStatus(detailItem.id, 'completed');
      showToast('success', isRTL ? 'مشارکت تأیید شد' : 'Contribution approved');
      setDetailModalOpen(false);
      load();
    } catch {
      showToast('error', isRTL ? 'انجام عملیات ناموفق بود' : 'Action failed');
    } finally {
      setDetailActionLoading(false);
    }
  }

  async function rejectFromDetail() {
    if (!detailItem) return;
    if (!rejectReason.trim()) {
      showToast('warning', isRTL ? 'دلیل رد را وارد کنید' : 'Enter a reason for rejection');
      return;
    }
    setDetailActionLoading(true);
    try {
      await fundAPI.updateContribution(detailItem.id, { status: 'failed', rejection_reason: rejectReason.trim() });
      showToast('success', isRTL ? 'مشارکت رد شد' : 'Contribution rejected');
      setDetailModalOpen(false);
      load();
    } catch {
      showToast('error', isRTL ? 'انجام عملیات ناموفق بود' : 'Action failed');
    } finally {
      setDetailActionLoading(false);
    }
  }

  async function openEdit(c: Contribution) {
    setEditModalOpen(true);
    setEditLoading(true);
    setEditId(c.id);
    try {
      const res = await fundAPI.getContributionDetail(c.id);
      const d = res.data as unknown as Contribution;
      setEditAmount(String(d.amount));
      setEditCurrency(d.currency);
      setEditGuestName(d.guest_name || '');
      setEditPaymentMethod(d.payment_method);
      setEditStatus(d.status);
      setEditNotes(d.notes || '');
      setEditRejectionReason(d.rejection_reason || '');
      setEditShowInPublicList(!!d.show_in_public_list);
      setEditDisplayNameChoice(d.display_name_choice || 'display_name');
      setEditPublicDisplayName(d.public_display_name || '');
      setEditMessage(d.message || '');
    } catch {
      showToast('error', isRTL ? 'بارگذاری جزئیات ناموفق بود' : 'Failed to load details');
      setEditModalOpen(false);
    } finally {
      setEditLoading(false);
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    const amountNum = parseFloat(editAmount);
    if (!amountNum || amountNum <= 0) {
      showToast('warning', isRTL ? 'مبلغ معتبر وارد کنید' : 'Enter a valid amount');
      return;
    }
    setEditSaving(true);
    try {
      await fundAPI.updateContribution(editId, {
        amount: amountNum,
        currency: editCurrency,
        guest_name: editGuestName,
        payment_method: editPaymentMethod,
        status: editStatus,
        notes: editNotes,
        rejection_reason: editRejectionReason,
        show_in_public_list: editShowInPublicList,
        display_name_choice: editDisplayNameChoice,
        public_display_name: editPublicDisplayName,
        message: editMessage,
      });
      showToast('success', isRTL ? 'مشارکت با موفقیت ویرایش شد' : 'Contribution updated successfully');
      setEditModalOpen(false);
      load();
    } catch {
      showToast('error', isRTL ? 'ویرایش مشارکت ناموفق بود' : 'Failed to update contribution');
    } finally {
      setEditSaving(false);
    }
  }

  if (!canView) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'شما دسترسی مشاهده مشارکت‌ها را ندارید.' : 'You do not have permission to view contributions.'}
      </div>
    );
  }

  function fmt(n: number) {
    return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(n);
  }

  const columns: AdminTableColumn<Contribution>[] = [
    {
      key: 'contributor',
      header: isRTL ? 'مشارکت‌کننده' : 'Contributor',
      render: (c) => <span className="text-white/80">{c.contributor?.display_name || c.contributor?.full_name || c.guest_name || (isRTL ? 'مهمان' : 'Guest')}</span>,
    },
    { key: 'amount', header: isRTL ? 'مبلغ' : 'Amount', render: (c) => <span className="text-white/70">{fmt(c.amount)} {c.currency}</span> },
    { key: 'method', header: isRTL ? 'روش پرداخت' : 'Method', render: (c) => <span className="text-white/50 text-xs">{getPaymentMethodLabel(c.payment_method, c.payment_method, isRTL)}</span> },
    { key: 'status', header: isRTL ? 'وضعیت' : 'Status', render: (c) => <AdminBadge status={c.status} /> },
    {
      key: 'created_at',
      header: isRTL ? 'تاریخ' : 'Date',
      render: (c) => <span className="text-white/40 text-xs">{new Date(c.created_at).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-US')}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => openDetail(c)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
            style={{ border: '1px solid rgba(0,255,255,0.25)', color: '#00ffff', backgroundColor: 'rgba(0,255,255,0.06)' }}
            aria-label={isRTL ? 'جزئیات' : 'Details'}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {canManage && (
            <button
              onClick={() => openEdit(c)}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.04)' }}
              aria-label={isRTL ? 'ویرایش' : 'Edit'}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {canManage && (c.status === 'pending' || c.status === 'pending_review') ? (
            <>
              <button
                onClick={() => setConfirmAction({ type: 'approve', contribution: c })}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
                style={{ border: '1px solid rgba(16,185,129,0.35)', color: '#10b981', backgroundColor: 'rgba(16,185,129,0.06)' }}
              >
                <Check className="w-3.5 h-3.5" />
                {isRTL ? 'تأیید' : 'Approve'}
              </button>
              <button
                onClick={() => setConfirmAction({ type: 'reject', contribution: c })}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
                style={{ border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.06)' }}
              >
                <X className="w-3.5 h-3.5" />
                {isRTL ? 'رد' : 'Reject'}
              </button>
            </>
          ) : null}
          {isSuperuser && (
            <button
              onClick={() => setConfirmAction({ type: 'delete', contribution: c })}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
              style={{ border: '1px solid rgba(239,68,68,0.25)', color: 'rgba(239,68,68,0.8)', backgroundColor: 'transparent' }}
              aria-label={isRTL ? 'حذف' : 'Delete'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const confirmCopy = {
    approve: {
      title: isRTL ? 'تأیید مشارکت' : 'Approve Contribution',
      message: isRTL ? 'آیا از تأیید این مشارکت مطمئن هستید؟' : 'Are you sure you want to approve this contribution?',
      label: isRTL ? 'تأیید' : 'Approve',
    },
    reject: {
      title: isRTL ? 'رد مشارکت' : 'Reject Contribution',
      message: isRTL ? 'آیا از رد این مشارکت مطمئن هستید؟' : 'Are you sure you want to reject this contribution?',
      label: isRTL ? 'رد کن' : 'Reject',
    },
    delete: {
      title: isRTL ? 'حذف مشارکت' : 'Delete Contribution',
      message: isRTL ? 'این عمل غیرقابل بازگشت است. آیا از حذف این مشارکت مطمئن هستید؟' : 'This action is irreversible. Are you sure you want to delete this contribution?',
      label: isRTL ? 'حذف کن' : 'Delete',
    },
  };

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{isRTL ? 'مشارکت‌ها' : 'Contributions'}</h1>
          <p className="text-sm text-white/40 mt-1">{isRTL ? 'مدیریت و تأیید مشارکت‌های مالی' : 'Manage and approve fund contributions'}</p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all"
            style={{ backgroundColor: '#00ffff', color: '#0a0a0f', boxShadow: '0 0 16px rgba(0,255,255,0.3)' }}
          >
            <Plus className="w-4 h-4" />
            {isRTL ? 'افزودن مشارکت' : 'Add Contribution'}
          </button>
        )}
      </div>

      {memberFilterId && (
        <div className="admin-glass-card p-3 flex items-center justify-between gap-3" style={{ border: '1px solid rgba(0,255,255,0.25)' }}>
          <span className="text-sm text-white/70">
            {isRTL ? `نمایش مشارکت‌های عضو: ${memberFilterName || memberFilterId}` : `Showing contributions for member: ${memberFilterName || memberFilterId}`}
          </span>
          <button onClick={clearMemberFilter} className="text-xs font-medium underline" style={{ color: '#00ffff' }}>
            {isRTL ? 'پاک‌کردن فیلتر' : 'Clear filter'}
          </button>
        </div>
      )}

      <div className="admin-glass-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminSelect
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          options={[
            { value: '', label: isRTL ? 'همه وضعیت‌ها' : 'All statuses' },
            { value: 'pending', label: isRTL ? 'در انتظار' : 'Pending' },
            { value: 'pending_review', label: isRTL ? 'در انتظار بررسی' : 'Pending Review' },
            { value: 'completed', label: isRTL ? 'تکمیل شده' : 'Completed' },
            { value: 'failed', label: isRTL ? 'ناموفق' : 'Failed' },
          ]}
        />
        <AdminSelect
          value={methodFilter}
          onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
          options={[
            { value: '', label: isRTL ? 'همه روش‌ها' : 'All methods' },
            { value: 'manual', label: isRTL ? 'دستی' : 'Manual' },
            { value: 'paypal', label: 'PayPal' },
          ]}
        />
      </div>

      <AdminTable
        columns={columns}
        data={items}
        loading={loading}
        rowKey={(c) => c.id}
        emptyMessage={isRTL ? 'مشارکتی یافت نشد' : 'No contributions found'}
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

      <AdminConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={runAction}
        loading={actionLoading}
        title={confirmAction ? confirmCopy[confirmAction.type].title : ''}
        message={confirmAction ? confirmCopy[confirmAction.type].message : ''}
        confirmLabel={confirmAction ? confirmCopy[confirmAction.type].label : ''}
        cancelLabel={isRTL ? 'انصراف' : 'Cancel'}
      />

      <AdminModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={isRTL ? 'افزودن مشارکت' : 'Add Contribution'}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <AdminInput label={isRTL ? 'نام مشارکت‌کننده' : 'Contributor Name'} value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
          <AdminInput label={isRTL ? 'مبلغ' : 'Amount'} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <AdminSelect
            label={isRTL ? 'واحد پول' : 'Currency'}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={(SETTINGS_META.default_currency.options || []).map((o) => ({
              value: o.value,
              label: isRTL ? o.label.fa : o.label.en,
            }))}
          />
          <AdminSelect
            label={isRTL ? 'روش پرداخت' : 'Payment Method'}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            options={[
              { value: 'manual', label: isRTL ? 'دستی' : 'Manual' },
              { value: 'paypal', label: 'PayPal' },
              { value: 'other', label: isRTL ? 'سایر' : 'Other' },
            ]}
          />
          <AdminSelect
            label={isRTL ? 'وضعیت' : 'Status'}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: 'pending', label: isRTL ? 'در انتظار' : 'Pending' },
              { value: 'pending_review', label: isRTL ? 'در انتظار بررسی' : 'Pending Review' },
              { value: 'completed', label: isRTL ? 'تکمیل شده' : 'Completed' },
              { value: 'failed', label: isRTL ? 'ناموفق' : 'Failed' },
            ]}
          />
          <AdminTextarea label={isRTL ? 'یادداشت (اختیاری)' : 'Notes (optional)'} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          <div className="flex items-center gap-3 mt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
              style={{ backgroundColor: '#00ffff', color: '#0a0a0f', boxShadow: '0 0 16px rgba(0,255,255,0.3)' }}
            >
              {saving ? (isRTL ? 'در حال ثبت...' : 'Saving...') : (isRTL ? 'ثبت مشارکت' : 'Add Contribution')}
            </button>
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl px-5 py-2.5 text-sm font-medium text-white/60 hover:text-white/90 transition-colors">
              {isRTL ? 'انصراف' : 'Cancel'}
            </button>
          </div>
        </form>
      </AdminModal>

      {/* Details modal */}
      <AdminModal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title={isRTL ? 'جزئیات مشارکت' : 'Contribution Details'} maxWidth="max-w-2xl">
        {detailLoading || !detailItem ? (
          <div className="py-8 text-center text-white/40 text-sm">{isRTL ? 'در حال بارگذاری...' : 'Loading...'}</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'مشارکت‌کننده' : 'Contributor'}</span>
                <span className="text-white/80 text-sm">
                  {detailItem.contributor?.full_name || detailItem.guest_name || (isRTL ? 'مهمان' : 'Guest')}
                  {detailItem.contributor?.display_name && detailItem.contributor.display_name !== detailItem.contributor.full_name && (
                    <span className="text-white/40 text-xs"> ({detailItem.contributor.display_name})</span>
                  )}
                </span>
              </div>
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'مبلغ' : 'Amount'}</span>
                <span className="text-white/80 text-sm">{fmt(detailItem.amount)} {detailItem.currency}</span>
              </div>
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'روش پرداخت' : 'Payment Method'}</span>
                <span className="text-white/80 text-sm">{getPaymentMethodLabel(detailItem.payment_method, detailItem.payment_method, isRTL)}</span>
              </div>
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'وضعیت' : 'Status'}</span>
                <AdminBadge status={detailItem.status} />
              </div>
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'تاریخ ایجاد' : 'Created'}</span>
                <span className="text-white/60 text-xs">{new Date(detailItem.created_at).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}</span>
              </div>
              {detailItem.updated_at && (
                <div>
                  <span className="block text-xs text-white/40 mb-1">{isRTL ? 'آخرین بروزرسانی' : 'Last Updated'}</span>
                  <span className="text-white/60 text-xs">{new Date(detailItem.updated_at).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}</span>
                </div>
              )}
            </div>

            {detailItem.notes && (
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'یادداشت' : 'Notes'}</span>
                <p className="text-white/70 text-sm whitespace-pre-wrap">{detailItem.notes}</p>
              </div>
            )}

            {/* Public listing info */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
              <span className="text-xs font-medium text-white/60">{isRTL ? 'نمایش عمومی' : 'Public Listing'}</span>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">{isRTL ? 'نمایش در فهرست عمومی' : 'Show in public list'}</span>
                <span className="text-white/80">{detailItem.show_in_public_list ? (isRTL ? 'بله' : 'Yes') : (isRTL ? 'خیر' : 'No')}</span>
              </div>
              {detailItem.show_in_public_list && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/50">{isRTL ? 'نوع نام نمایشی' : 'Display name type'}</span>
                    <span className="text-white/80">
                      {DISPLAY_NAME_CHOICE_OPTIONS(isRTL).find((o) => o.value === detailItem.display_name_choice)?.label}
                    </span>
                  </div>
                  {detailItem.display_name_choice === 'custom' && detailItem.public_display_name && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/50">{isRTL ? 'نام دلخواه' : 'Custom name'}</span>
                      <span className="text-white/80">{detailItem.public_display_name}</span>
                    </div>
                  )}
                </>
              )}
              {detailItem.message && (
                <div>
                  <span className="block text-white/50 text-sm mb-1">{isRTL ? 'پیام' : 'Message'}</span>
                  <p className="text-white/80 text-sm whitespace-pre-wrap">{detailItem.message}</p>
                </div>
              )}
            </div>

            {/* Receipt image */}
            {detailItem.receipt_image && (
              <div>
                <span className="block text-xs text-white/40 mb-2">{isRTL ? 'تصویر رسید' : 'Receipt Image'}</span>
                <button
                  type="button"
                  onClick={() => setLightboxSrc(detailItem.receipt_image || null)}
                  className="relative w-32 h-32 rounded-xl overflow-hidden transition-all duration-200 hover:ring-2 hover:ring-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={detailItem.receipt_image} alt={isRTL ? 'تصویر رسید' : 'Receipt'} className="w-full h-full object-cover" />
                </button>
              </div>
            )}

            {/* Existing rejection reason */}
            {detailItem.status === 'failed' && detailItem.rejection_reason && (
              <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(239,68,68,0.25)', backgroundColor: 'rgba(239,68,68,0.05)' }}>
                <span className="block text-xs mb-1" style={{ color: '#ef4444' }}>{isRTL ? 'دلیل رد' : 'Rejection Reason'}</span>
                <p className="text-white/70 text-sm">{detailItem.rejection_reason}</p>
              </div>
            )}

            {/* Approve / Reject actions */}
            {canManage && (detailItem.status === 'pending' || detailItem.status === 'pending_review') && (
              <div className="flex flex-col gap-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <AdminTextarea
                  label={isRTL ? 'دلیل رد (در صورت رد کردن)' : 'Rejection reason (if rejecting)'}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={approveFromDetail}
                    disabled={detailActionLoading}
                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
                    style={{ border: '1px solid rgba(16,185,129,0.35)', color: '#10b981', backgroundColor: 'rgba(16,185,129,0.06)' }}
                  >
                    <Check className="w-4 h-4" />
                    {isRTL ? 'تأیید' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={rejectFromDetail}
                    disabled={detailActionLoading}
                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
                    style={{ border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.06)' }}
                  >
                    <X className="w-4 h-4" />
                    {isRTL ? 'رد' : 'Reject'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </AdminModal>

      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt={isRTL ? 'تصویر رسید' : 'Receipt'}
          onClose={() => setLightboxSrc(null)}
        />
      )}

      {/* Edit modal */}
      <AdminModal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title={isRTL ? 'ویرایش مشارکت' : 'Edit Contribution'} maxWidth="max-w-2xl">
        {editLoading ? (
          <div className="py-8 text-center text-white/40 text-sm">{isRTL ? 'در حال بارگذاری...' : 'Loading...'}</div>
        ) : (
          <form onSubmit={submitEdit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AdminInput label={isRTL ? 'نام مشارکت‌کننده' : 'Contributor Name'} value={editGuestName} onChange={(e) => setEditGuestName(e.target.value)} />
              <AdminInput label={isRTL ? 'مبلغ' : 'Amount'} type="number" min="0" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} required />
              <AdminSelect
                label={isRTL ? 'واحد پول' : 'Currency'}
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value)}
                options={(SETTINGS_META.default_currency.options || []).map((o) => ({
                  value: o.value,
                  label: isRTL ? o.label.fa : o.label.en,
                }))}
              />
              <AdminSelect
                label={isRTL ? 'روش پرداخت' : 'Payment Method'}
                value={editPaymentMethod}
                onChange={(e) => setEditPaymentMethod(e.target.value)}
                options={Object.entries(PAYMENT_METHOD_LABELS).map(([value, meta]) => ({
                  value,
                  label: isRTL ? meta.fa : meta.en,
                }))}
              />
              <AdminSelect
                label={isRTL ? 'وضعیت' : 'Status'}
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                options={STATUS_OPTIONS_BIDIRECTIONAL(isRTL)}
              />
            </div>

            <AdminTextarea label={isRTL ? 'یادداشت' : 'Notes'} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} />

            {editStatus === 'failed' && (
              <AdminTextarea label={isRTL ? 'دلیل رد' : 'Rejection reason'} value={editRejectionReason} onChange={(e) => setEditRejectionReason(e.target.value)} rows={2} />
            )}

            <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-3">
              <AdminToggle
                checked={editShowInPublicList}
                onChange={setEditShowInPublicList}
                label={isRTL ? 'نمایش در فهرست عمومی مشارکت‌کنندگان' : 'Show in public contributors list'}
              />
              {editShowInPublicList && (
                <>
                  <AdminSelect
                    label={isRTL ? 'نوع نام نمایشی' : 'Display name type'}
                    value={editDisplayNameChoice}
                    onChange={(e) => setEditDisplayNameChoice(e.target.value as ContributionDisplayNameChoice)}
                    options={DISPLAY_NAME_CHOICE_OPTIONS(isRTL)}
                  />
                  {editDisplayNameChoice === 'custom' && (
                    <AdminInput
                      label={isRTL ? 'نام دلخواه' : 'Custom name'}
                      value={editPublicDisplayName}
                      onChange={(e) => setEditPublicDisplayName(e.target.value)}
                      maxLength={100}
                    />
                  )}
                </>
              )}
              <AdminTextarea
                label={isRTL ? `پیام (${editMessage.length}/150)` : `Message (${editMessage.length}/150)`}
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value.slice(0, 150))}
                rows={2}
                maxLength={150}
              />
            </div>

            <div className="flex items-center gap-3 mt-1">
              <button
                type="submit"
                disabled={editSaving}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
                style={{ backgroundColor: '#00ffff', color: '#0a0a0f', boxShadow: '0 0 16px rgba(0,255,255,0.3)' }}
              >
                {editSaving ? (isRTL ? 'در حال ذخیره...' : 'Saving...') : (isRTL ? 'ذخیره' : 'Save')}
              </button>
              <button type="button" onClick={() => setEditModalOpen(false)} className="rounded-xl px-5 py-2.5 text-sm font-medium text-white/60 hover:text-white/90 transition-colors">
                {isRTL ? 'انصراف' : 'Cancel'}
              </button>
            </div>
          </form>
        )}
      </AdminModal>
    </div>
  );
}
