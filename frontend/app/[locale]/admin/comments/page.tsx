'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Check, Trash2, Star } from 'lucide-react';
import AdminTable, { AdminTableColumn } from '@/components/admin/AdminTable';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';
import AdminBadge from '@/components/admin/AdminBadge';
import AdminInput from '@/components/admin/fields/AdminInput';
import AdminSelect from '@/components/admin/fields/AdminSelect';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { commentsAPI, Comment, Paginated } from '@/lib/api';

type ConfirmAction = { type: 'approve' | 'delete'; comment: Comment } | null;
type StatusFilter = '' | 'true' | 'false';
type TargetFilter = '' | 'post' | 'expense';

export default function AdminCommentsPage() {
  const params = useParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const { hasPermission, member: currentMember } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const canApprove = !!currentMember?.is_superuser || hasPermission('can_approve_comments');
  const canDelete = !!currentMember?.is_superuser || hasPermission('can_manage_permissions');

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [statusInput, setStatusInput] = useState<StatusFilter>('');
  const [targetInput, setTargetInput] = useState<TargetFilter>('');
  const [appliedFilters, setAppliedFilters] = useState<{ search: string; is_approved: StatusFilter; target_type: TargetFilter }>({
    search: '',
    is_approved: '',
    target_type: '',
  });

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [actionLoading, setActionLoading] = useState(false);

  function load() {
    setLoading(true);
    commentsAPI
      .getList(page, {
        search: appliedFilters.search || undefined,
        is_approved: appliedFilters.is_approved || undefined,
        target_type: appliedFilters.target_type || undefined,
      })
      .then((res) => {
        const data = res.data as unknown as Paginated<Comment>;
        setComments(data.results);
        setHasNext(!!data.next);
      })
      .catch(() => showToast('error', isRTL ? 'بارگذاری نظرات ناموفق بود' : 'Failed to load comments'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (canApprove) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canApprove, page, appliedFilters]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setAppliedFilters({ search: searchInput.trim(), is_approved: statusInput, target_type: targetInput });
  }

  async function runAction() {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction.type === 'approve') {
        await commentsAPI.approve(confirmAction.comment.id);
        showToast('success', isRTL ? 'نظر تأیید شد' : 'Comment approved');
      } else {
        await commentsAPI.delete(confirmAction.comment.id);
        showToast('success', isRTL ? 'نظر حذف شد' : 'Comment deleted');
      }
      setConfirmAction(null);
      load();
    } catch {
      showToast('error', isRTL ? 'انجام عملیات ناموفق بود' : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  if (!canApprove) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'شما دسترسی مدیریت نظرات را ندارید.' : 'You do not have permission to manage comments.'}
      </div>
    );
  }

  const statusOptions = [
    { value: '', label: isRTL ? 'همه' : 'All' },
    { value: 'false', label: isRTL ? 'در انتظار تأیید' : 'Pending' },
    { value: 'true', label: isRTL ? 'تأیید شده' : 'Approved' },
  ];

  const targetOptions = [
    { value: '', label: isRTL ? 'همه' : 'All' },
    { value: 'post', label: isRTL ? 'پست' : 'Post' },
    { value: 'expense', label: isRTL ? 'هزینه' : 'Expense' },
  ];

  const columns: AdminTableColumn<Comment>[] = [
    {
      key: 'author',
      header: isRTL ? 'نویسنده' : 'Author',
      render: (c) => <span className="text-white/80 text-sm">{c.author_label || c.guest_name || (isRTL ? 'مهمان' : 'Guest')}</span>,
    },
    {
      key: 'text',
      header: isRTL ? 'متن نظر' : 'Comment',
      render: (c) => <span className="text-white/60 text-xs truncate max-w-[16rem] block">{c.text}</span>,
    },
    {
      key: 'rating',
      header: isRTL ? 'امتیاز' : 'Rating',
      render: (c) =>
        typeof c.rating === 'number' && c.rating > 0 ? (
          <span className="flex items-center gap-1 text-xs" style={{ color: '#fbbf24' }}>
            <Star className="w-3.5 h-3.5" fill="#fbbf24" />
            {c.rating}
          </span>
        ) : (
          <span className="text-white/30 text-xs">—</span>
        ),
    },
    {
      key: 'status',
      header: isRTL ? 'وضعیت' : 'Status',
      render: (c) => <AdminBadge status={c.is_approved ? 'approved' : 'pending'} />,
    },
    {
      key: 'created_at',
      header: isRTL ? 'زمان' : 'Time',
      render: (c) => <span className="text-white/40 text-xs">{new Date(c.created_at).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <div className="flex items-center gap-2 flex-shrink-0">
          {!c.is_approved && (
            <button
              onClick={() => setConfirmAction({ type: 'approve', comment: c })}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={{ border: '1px solid rgba(16,185,129,0.35)', color: '#10b981', backgroundColor: 'rgba(16,185,129,0.06)' }}
            >
              <Check className="w-3.5 h-3.5" />
              {isRTL ? 'تأیید' : 'Approve'}
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => setConfirmAction({ type: 'delete', comment: c })}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={{ border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.06)' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isRTL ? 'حذف' : 'Delete'}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-white">{isRTL ? 'نظرات' : 'Comments'}</h1>
        <p className="text-sm text-white/40 mt-1">{isRTL ? 'بررسی، فیلتر و تأیید نظرات کاربران' : 'Review, filter, and moderate user comments'}</p>
      </div>

      <form onSubmit={applyFilters} className="admin-glass-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <AdminInput label={isRTL ? 'جست‌وجو' : 'Search'} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        <AdminSelect
          label={isRTL ? 'وضعیت' : 'Status'}
          options={statusOptions}
          value={statusInput}
          onChange={(e) => setStatusInput(e.target.value as StatusFilter)}
        />
        <AdminSelect
          label={isRTL ? 'نوع هدف' : 'Target Type'}
          options={targetOptions}
          value={targetInput}
          onChange={(e) => setTargetInput(e.target.value as TargetFilter)}
        />
        <button
          type="submit"
          className="rounded-xl px-5 py-2.5 text-sm font-bold transition-all"
          style={{ backgroundColor: '#00ffff', color: '#0a0a0f', boxShadow: '0 0 16px rgba(0,255,255,0.3)' }}
        >
          {isRTL ? 'فیلتر' : 'Filter'}
        </button>
      </form>

      <AdminTable
        columns={columns}
        data={comments}
        loading={loading}
        rowKey={(c) => c.id}
        emptyMessage={isRTL ? 'نظری یافت نشد' : 'No comments found'}
        pagination={{ page, hasNext, hasPrev: page > 1, onPageChange: setPage }}
      />

      <AdminConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={runAction}
        loading={actionLoading}
        title={confirmAction?.type === 'approve' ? (isRTL ? 'تأیید نظر' : 'Approve Comment') : (isRTL ? 'حذف نظر' : 'Delete Comment')}
        message={
          confirmAction?.type === 'approve'
            ? (isRTL ? 'آیا از تأیید این نظر مطمئن هستید؟' : 'Are you sure you want to approve this comment?')
            : (isRTL ? 'این عمل غیرقابل بازگشت است. آیا از حذف این نظر مطمئن هستید؟' : 'This action is irreversible. Are you sure you want to delete this comment?')
        }
        confirmLabel={confirmAction?.type === 'approve' ? (isRTL ? 'تأیید' : 'Approve') : (isRTL ? 'حذف کن' : 'Delete')}
        cancelLabel={isRTL ? 'انصراف' : 'Cancel'}
      />
    </div>
  );
}
