'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Check, X, Trash2, Plus } from 'lucide-react';
import AdminTable, { AdminTableColumn } from '@/components/admin/AdminTable';
import AdminBadge from '@/components/admin/AdminBadge';
import AdminModal from '@/components/admin/AdminModal';
import AdminSelect from '@/components/admin/fields/AdminSelect';
import AdminInput from '@/components/admin/fields/AdminInput';
import AdminTextarea from '@/components/admin/fields/AdminTextarea';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { fundAPI, Contribution, Paginated } from '@/lib/api';
import { SETTINGS_META } from '@/lib/settingsMeta';

type ConfirmAction = { type: 'approve' | 'reject' | 'delete'; contribution: Contribution } | null;

export default function AdminContributionsPage() {
  const params = useParams();
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

  function load() {
    setLoading(true);
    const filters: { status?: string; payment_method?: string } = {};
    if (statusFilter) filters.status = statusFilter;
    if (methodFilter) filters.payment_method = methodFilter;
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
  }, [canView, page, statusFilter, methodFilter]);

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
    { key: 'method', header: isRTL ? 'روش پرداخت' : 'Method', render: (c) => <span className="text-white/50 text-xs">{c.payment_method}</span> },
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

      <div className="admin-glass-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminSelect
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          placeholder={isRTL ? 'همه وضعیت‌ها' : 'All statuses'}
          options={[
            { value: 'pending', label: isRTL ? 'در انتظار' : 'Pending' },
            { value: 'pending_review', label: isRTL ? 'در انتظار بررسی' : 'Pending Review' },
            { value: 'completed', label: isRTL ? 'تکمیل شده' : 'Completed' },
            { value: 'failed', label: isRTL ? 'ناموفق' : 'Failed' },
          ]}
        />
        <AdminSelect
          value={methodFilter}
          onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
          placeholder={isRTL ? 'همه روش‌ها' : 'All methods'}
          options={[
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
    </div>
  );
}
