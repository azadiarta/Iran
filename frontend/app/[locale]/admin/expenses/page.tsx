'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Trash2, Receipt as ReceiptIcon } from 'lucide-react';
import AdminTable, { AdminTableColumn } from '@/components/admin/AdminTable';
import AdminModal from '@/components/admin/AdminModal';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';
import AdminInput from '@/components/admin/fields/AdminInput';
import AdminTextarea from '@/components/admin/fields/AdminTextarea';
import AdminFileUpload from '@/components/admin/fields/AdminFileUpload';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { fundAPI, Expense, Paginated } from '@/lib/api';

export default function AdminExpensesPage() {
  const params = useParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const { hasPermission, member: currentMember } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const canView = !!currentMember?.is_superuser || hasPermission('can_view_balance');
  const canCreate = !!currentMember?.is_superuser || hasPermission('can_expense');
  const canDelete = !!currentMember?.is_superuser || hasPermission('can_manage_permissions');

  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [shortReason, setShortReason] = useState('');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  function load() {
    setLoading(true);
    fundAPI
      .getExpenses(page)
      .then((res) => {
        const data = res.data as unknown as Paginated<Expense>;
        setItems(data.results);
        setHasNext(!!data.next);
      })
      .catch(() => showToast('error', isRTL ? 'بارگذاری هزینه‌ها ناموفق بود' : 'Failed to load expenses'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (canView) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, page]);

  function openCreate() {
    setAmount('');
    setShortReason('');
    setDescription('');
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setReceipt(null);
    setModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      showToast('warning', isRTL ? 'مبلغ معتبر وارد کنید' : 'Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      await fundAPI.createExpense({
        amount: amountNum,
        short_reason: shortReason,
        description: description || undefined,
        receipt_image: receipt || undefined,
        expense_date: expenseDate,
      });
      showToast('success', isRTL ? 'هزینه با موفقیت ثبت شد' : 'Expense recorded successfully');
      setModalOpen(false);
      load();
    } catch {
      showToast('error', isRTL ? 'ثبت هزینه ناموفق بود' : 'Failed to record expense');
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setActionLoading(true);
    try {
      await fundAPI.deleteExpense(confirmDelete.id);
      showToast('success', isRTL ? 'هزینه با موفقیت حذف شد' : 'Expense deleted successfully');
      setConfirmDelete(null);
      load();
    } catch {
      showToast('error', isRTL ? 'حذف هزینه ناموفق بود' : 'Failed to delete expense');
    } finally {
      setActionLoading(false);
    }
  }

  if (!canView) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'شما دسترسی مشاهده هزینه‌ها را ندارید.' : 'You do not have permission to view expenses.'}
      </div>
    );
  }

  function fmt(n: number) {
    return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(n);
  }

  const columns: AdminTableColumn<Expense>[] = [
    { key: 'reason', header: isRTL ? 'علت' : 'Reason', render: (e) => <span className="text-white/80">{e.short_reason}</span> },
    { key: 'amount', header: isRTL ? 'مبلغ' : 'Amount', render: (e) => <span style={{ color: '#ef4444' }}>-{fmt(e.amount)}</span> },
    { key: 'withdrawn_by', header: isRTL ? 'برداشت توسط' : 'Withdrawn By', render: (e) => <span className="text-white/60">{e.withdrawn_by?.display_name || '—'}</span> },
    {
      key: 'receipt',
      header: isRTL ? 'رسید' : 'Receipt',
      render: (e) =>
        e.receipt_image ? (
          <a href={e.receipt_image} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs" style={{ color: '#00ffff' }}>
            <ReceiptIcon className="w-3.5 h-3.5" />
            {isRTL ? 'مشاهده' : 'View'}
          </a>
        ) : (
          <span className="text-white/30 text-xs">—</span>
        ),
    },
    {
      key: 'expense_date',
      header: isRTL ? 'تاریخ' : 'Date',
      render: (e) => <span className="text-white/40 text-xs">{new Date(e.expense_date).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-US')}</span>,
    },
    ...(canDelete
      ? [
          {
            key: 'actions',
            header: '',
            render: (e: Expense) => (
              <button
                onClick={() => setConfirmDelete(e)}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
                style={{ border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.05)' }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            ),
          } as AdminTableColumn<Expense>,
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{isRTL ? 'هزینه‌ها' : 'Expenses'}</h1>
          <p className="text-sm text-white/40 mt-1">{isRTL ? 'مدیریت برداشت‌ها و هزینه‌های صندوق' : 'Manage fund withdrawals and expenses'}</p>
        </div>
        {canCreate && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all"
            style={{ backgroundColor: '#00ffff', color: '#0a0a0f', boxShadow: '0 0 16px rgba(0,255,255,0.3)' }}
          >
            <Plus className="w-4 h-4" />
            {isRTL ? 'ثبت هزینه' : 'Add Expense'}
          </button>
        )}
      </div>

      <AdminTable
        columns={columns}
        data={items}
        loading={loading}
        rowKey={(e) => e.id}
        emptyMessage={isRTL ? 'هزینه‌ای یافت نشد' : 'No expenses found'}
        pagination={{ page, hasNext, hasPrev: page > 1, onPageChange: setPage }}
      />

      <AdminModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={isRTL ? 'ثبت هزینه جدید' : 'Record New Expense'}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <AdminInput label={isRTL ? 'مبلغ' : 'Amount'} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <AdminInput label={isRTL ? 'علت کوتاه' : 'Short Reason'} value={shortReason} onChange={(e) => setShortReason(e.target.value)} required />
          <AdminTextarea label={isRTL ? 'توضیحات' : 'Description'} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          <AdminInput label={isRTL ? 'تاریخ هزینه' : 'Expense Date'} type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
          <AdminFileUpload
            label={isRTL ? 'تصویر رسید (اختیاری)' : 'Receipt Image (optional)'}
            accept="image/*"
            onChange={(files) => setReceipt(files[0] || null)}
          />
          <div className="flex items-center gap-3 mt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
              style={{ backgroundColor: '#00ffff', color: '#0a0a0f', boxShadow: '0 0 16px rgba(0,255,255,0.3)' }}
            >
              {saving ? (isRTL ? 'در حال ثبت...' : 'Saving...') : (isRTL ? 'ثبت هزینه' : 'Record Expense')}
            </button>
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl px-5 py-2.5 text-sm font-medium text-white/60 hover:text-white/90 transition-colors">
              {isRTL ? 'انصراف' : 'Cancel'}
            </button>
          </div>
        </form>
      </AdminModal>

      <AdminConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        loading={actionLoading}
        title={isRTL ? 'حذف هزینه' : 'Delete Expense'}
        message={isRTL ? 'این عمل غیرقابل بازگشت است. آیا از حذف این هزینه مطمئن هستید؟' : 'This action is irreversible. Are you sure you want to delete this expense?'}
        confirmLabel={isRTL ? 'حذف کن' : 'Delete'}
        cancelLabel={isRTL ? 'انصراف' : 'Cancel'}
      />
    </div>
  );
}
