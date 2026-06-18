'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Check, X, Trash2, Eye, Pencil, Star } from 'lucide-react';
import AdminTable, { AdminTableColumn } from '@/components/admin/AdminTable';
import AdminBadge from '@/components/admin/AdminBadge';
import AdminModal from '@/components/admin/AdminModal';
import AdminSelect from '@/components/admin/fields/AdminSelect';
import AdminInput from '@/components/admin/fields/AdminInput';
import AdminTextarea from '@/components/admin/fields/AdminTextarea';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { commentsAPI, Comment, CommentDetail, CommentStatus, Paginated } from '@/lib/api';

const STATUS_OPTIONS_BIDIRECTIONAL = (isRTL: boolean) => [
  { value: 'pending', label: isRTL ? 'در انتظار' : 'Pending' },
  { value: 'approved', label: isRTL ? 'تأیید شده' : 'Approved' },
  { value: 'rejected', label: isRTL ? 'رد شده' : 'Rejected' },
];

const RATING_OPTIONS = (isRTL: boolean) => [
  { value: '0', label: isRTL ? 'بدون امتیاز' : 'No rating' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
];

type ConfirmAction = { type: 'approve' | 'reject' | 'delete'; comment: Comment } | null;
type TargetFilter = '' | 'post' | 'expense';

export default function AdminCommentsPage() {
  const params = useParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const { hasPermission, member: currentMember } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const isSuperuser = !!currentMember?.is_superuser;
  const canManage = isSuperuser || hasPermission('can_approve_comments');
  const canDelete = isSuperuser || hasPermission('can_manage_permissions');

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | CommentStatus>('');
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Details modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<CommentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailActionLoading, setDetailActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editText, setEditText] = useState('');
  const [editRating, setEditRating] = useState('0');
  const [editStatus, setEditStatus] = useState<CommentStatus>('pending');
  const [editRejectionReason, setEditRejectionReason] = useState('');

  function load() {
    setLoading(true);
    commentsAPI
      .getList(page, {
        search: appliedSearch || undefined,
        status: statusFilter || undefined,
        target_type: targetFilter || undefined,
      })
      .then((res) => {
        const data = res.data as unknown as Paginated<Comment>;
        setComments(data.results);
        setHasNext(!!data.next);
        setTotalCount(data.count);
      })
      .catch(() => showToast('error', isRTL ? 'بارگذاری نظرات ناموفق بود' : 'Failed to load comments'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (canManage) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, page, appliedSearch, statusFilter, targetFilter]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  }

  async function runAction() {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction.type === 'approve') {
        await commentsAPI.updateStatus(confirmAction.comment.id, 'approved');
        showToast('success', isRTL ? 'نظر تأیید شد' : 'Comment approved');
      } else if (confirmAction.type === 'reject') {
        await commentsAPI.updateStatus(confirmAction.comment.id, 'rejected');
        showToast('success', isRTL ? 'نظر رد شد' : 'Comment rejected');
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

  async function openDetail(c: Comment) {
    setDetailModalOpen(true);
    setDetailLoading(true);
    setDetailItem(null);
    setRejectReason('');
    try {
      const res = await commentsAPI.getDetail(c.id);
      setDetailItem(res.data as unknown as CommentDetail);
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
      await commentsAPI.updateStatus(detailItem.id, 'approved');
      showToast('success', isRTL ? 'نظر تأیید شد' : 'Comment approved');
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
      await commentsAPI.update(detailItem.id, { status: 'rejected', rejection_reason: rejectReason.trim() });
      showToast('success', isRTL ? 'نظر رد شد' : 'Comment rejected');
      setDetailModalOpen(false);
      load();
    } catch {
      showToast('error', isRTL ? 'انجام عملیات ناموفق بود' : 'Action failed');
    } finally {
      setDetailActionLoading(false);
    }
  }

  async function openEdit(c: Comment) {
    setEditModalOpen(true);
    setEditLoading(true);
    setEditId(c.id);
    try {
      const res = await commentsAPI.getDetail(c.id);
      const d = res.data as unknown as CommentDetail;
      setEditText(d.text);
      setEditRating(String(d.rating || 0));
      setEditStatus(d.status);
      setEditRejectionReason(d.rejection_reason || '');
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
    if (!editText.trim()) {
      showToast('warning', isRTL ? 'متن نظر را وارد کنید' : 'Enter the comment text');
      return;
    }
    setEditSaving(true);
    try {
      await commentsAPI.update(editId, {
        text: editText,
        rating: parseInt(editRating, 10) || null,
        status: editStatus,
        rejection_reason: editRejectionReason,
      });
      showToast('success', isRTL ? 'نظر با موفقیت ویرایش شد' : 'Comment updated successfully');
      setEditModalOpen(false);
      load();
    } catch {
      showToast('error', isRTL ? 'ویرایش نظر ناموفق بود' : 'Failed to update comment');
    } finally {
      setEditSaving(false);
    }
  }

  if (!canManage) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'شما دسترسی مدیریت نظرات را ندارید.' : 'You do not have permission to manage comments.'}
      </div>
    );
  }

  const confirmCopy = {
    approve: {
      title: isRTL ? 'تأیید نظر' : 'Approve Comment',
      message: isRTL ? 'آیا از تأیید این نظر مطمئن هستید؟' : 'Are you sure you want to approve this comment?',
      label: isRTL ? 'تأیید' : 'Approve',
    },
    reject: {
      title: isRTL ? 'رد نظر' : 'Reject Comment',
      message: isRTL ? 'آیا از رد این نظر مطمئن هستید؟' : 'Are you sure you want to reject this comment?',
      label: isRTL ? 'رد کن' : 'Reject',
    },
    delete: {
      title: isRTL ? 'حذف نظر' : 'Delete Comment',
      message: isRTL ? 'این عمل غیرقابل بازگشت است. آیا از حذف این نظر مطمئن هستید؟' : 'This action is irreversible. Are you sure you want to delete this comment?',
      label: isRTL ? 'حذف کن' : 'Delete',
    },
  };

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
    { key: 'status', header: isRTL ? 'وضعیت' : 'Status', render: (c) => <AdminBadge status={c.status} /> },
    {
      key: 'created_at',
      header: isRTL ? 'زمان' : 'Time',
      render: (c) => <span className="text-white/40 text-xs">{new Date(c.created_at).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}</span>,
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
          <button
            onClick={() => openEdit(c)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.04)' }}
            aria-label={isRTL ? 'ویرایش' : 'Edit'}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {c.status === 'pending' && (
            <>
              <button
                onClick={() => setConfirmAction({ type: 'approve', comment: c })}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
                style={{ border: '1px solid rgba(16,185,129,0.35)', color: '#10b981', backgroundColor: 'rgba(16,185,129,0.06)' }}
              >
                <Check className="w-3.5 h-3.5" />
                {isRTL ? 'تأیید' : 'Approve'}
              </button>
              <button
                onClick={() => setConfirmAction({ type: 'reject', comment: c })}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
                style={{ border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.06)' }}
              >
                <X className="w-3.5 h-3.5" />
                {isRTL ? 'رد' : 'Reject'}
              </button>
            </>
          )}
          {canDelete && (
            <button
              onClick={() => setConfirmAction({ type: 'delete', comment: c })}
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

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-white">{isRTL ? 'نظرات' : 'Comments'}</h1>
        <p className="text-sm text-white/40 mt-1">{isRTL ? 'بررسی، ویرایش و تأیید نظرات کاربران' : 'Review, edit, and moderate user comments'}</p>
      </div>

      <form onSubmit={applySearch} className="admin-glass-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <AdminInput label={isRTL ? 'جست‌وجو' : 'Search'} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        <AdminSelect
          label={isRTL ? 'وضعیت' : 'Status'}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as '' | CommentStatus); setPage(1); }}
          options={[
            { value: '', label: isRTL ? 'همه وضعیت‌ها' : 'All statuses' },
            { value: 'pending', label: isRTL ? 'در انتظار' : 'Pending' },
            { value: 'approved', label: isRTL ? 'تأیید شده' : 'Approved' },
            { value: 'rejected', label: isRTL ? 'رد شده' : 'Rejected' },
          ]}
        />
        <AdminSelect
          label={isRTL ? 'نوع هدف' : 'Target Type'}
          value={targetFilter}
          onChange={(e) => { setTargetFilter(e.target.value as TargetFilter); setPage(1); }}
          options={[
            { value: '', label: isRTL ? 'همه' : 'All' },
            { value: 'post', label: isRTL ? 'پست' : 'Post' },
            { value: 'expense', label: isRTL ? 'هزینه' : 'Expense' },
          ]}
        />
        <button
          type="submit"
          className="rounded-xl px-5 py-2.5 text-sm font-bold transition-all"
          style={{ backgroundColor: '#00ffff', color: '#0a0a0f', boxShadow: '0 0 16px rgba(0,255,255,0.3)' }}
        >
          {isRTL ? 'جست‌وجو' : 'Search'}
        </button>
      </form>

      <AdminTable
        columns={columns}
        data={comments}
        loading={loading}
        rowKey={(c) => c.id}
        emptyMessage={isRTL ? 'نظری یافت نشد' : 'No comments found'}
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

      {/* Details modal */}
      <AdminModal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title={isRTL ? 'جزئیات نظر' : 'Comment Details'} maxWidth="max-w-2xl">
        {detailLoading || !detailItem ? (
          <div className="py-8 text-center text-white/40 text-sm">{isRTL ? 'در حال بارگذاری...' : 'Loading...'}</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'نویسنده' : 'Author'}</span>
                <span className="text-white/80 text-sm">{detailItem.author_label || detailItem.guest_name || (isRTL ? 'مهمان' : 'Guest')}</span>
              </div>
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'امتیاز' : 'Rating'}</span>
                {typeof detailItem.rating === 'number' && detailItem.rating > 0 ? (
                  <span className="flex items-center gap-1 text-sm" style={{ color: '#fbbf24' }}>
                    <Star className="w-4 h-4" fill="#fbbf24" />
                    {detailItem.rating}
                  </span>
                ) : (
                  <span className="text-white/30 text-sm">—</span>
                )}
              </div>
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'هدف نظر' : 'Target'}</span>
                <span className="text-white/80 text-sm">
                  {detailItem.target_type === 'post' ? (isRTL ? 'پست' : 'Post') : (isRTL ? 'هزینه' : 'Expense')}
                  {detailItem.target_label ? `: ${detailItem.target_label}` : ''}
                </span>
              </div>
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'وضعیت' : 'Status'}</span>
                <AdminBadge status={detailItem.status} />
              </div>
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'تاریخ ایجاد' : 'Created'}</span>
                <span className="text-white/60 text-xs">{new Date(detailItem.created_at).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}</span>
              </div>
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'آخرین بروزرسانی' : 'Last Updated'}</span>
                <span className="text-white/60 text-xs">{new Date(detailItem.updated_at).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}</span>
              </div>
            </div>

            <div>
              <span className="block text-xs text-white/40 mb-1">{isRTL ? 'متن نظر' : 'Comment Text'}</span>
              <p className="text-white/70 text-sm whitespace-pre-wrap">{detailItem.text}</p>
            </div>

            {detailItem.status === 'rejected' && detailItem.rejection_reason && (
              <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(239,68,68,0.25)', backgroundColor: 'rgba(239,68,68,0.05)' }}>
                <span className="block text-xs mb-1" style={{ color: '#ef4444' }}>{isRTL ? 'دلیل رد' : 'Rejection Reason'}</span>
                <p className="text-white/70 text-sm">{detailItem.rejection_reason}</p>
              </div>
            )}

            {detailItem.status === 'pending' && (
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

      {/* Edit modal */}
      <AdminModal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title={isRTL ? 'ویرایش نظر' : 'Edit Comment'} maxWidth="max-w-2xl">
        {editLoading ? (
          <div className="py-8 text-center text-white/40 text-sm">{isRTL ? 'در حال بارگذاری...' : 'Loading...'}</div>
        ) : (
          <form onSubmit={submitEdit} className="flex flex-col gap-4">
            <AdminTextarea label={isRTL ? 'متن نظر' : 'Comment Text'} value={editText} onChange={(e) => setEditText(e.target.value)} rows={4} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AdminSelect label={isRTL ? 'امتیاز' : 'Rating'} value={editRating} onChange={(e) => setEditRating(e.target.value)} options={RATING_OPTIONS(isRTL)} />
              <AdminSelect
                label={isRTL ? 'وضعیت' : 'Status'}
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as CommentStatus)}
                options={STATUS_OPTIONS_BIDIRECTIONAL(isRTL)}
              />
            </div>

            {editStatus === 'rejected' && (
              <AdminTextarea label={isRTL ? 'دلیل رد' : 'Rejection reason'} value={editRejectionReason} onChange={(e) => setEditRejectionReason(e.target.value)} rows={2} />
            )}

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
