'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Check, X, Eye, Star } from 'lucide-react';
import AdminTable, { AdminTableColumn } from '@/components/admin/AdminTable';
import AdminBadge from '@/components/admin/AdminBadge';
import AdminModal from '@/components/admin/AdminModal';
import AdminSelect from '@/components/admin/fields/AdminSelect';
import AdminInput from '@/components/admin/fields/AdminInput';
import AdminTextarea from '@/components/admin/fields/AdminTextarea';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { commentsAPI, Comment, CommentDetail, CommentStatus, Paginated } from '@/lib/api';

// "No rating" stays selectable here (unlike the public submission form) so
// admins can still view/edit legacy comments that predate mandatory ratings.
const RATING_OPTIONS = (isRTL: boolean) => [
  { value: '0', label: isRTL ? 'بدون امتیاز' : 'No rating' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
];

type TargetFilter = '' | 'post' | 'expense';

export default function AdminCommentsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const { hasPermission, member: currentMember } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const isSuperuser = !!currentMember?.is_superuser;
  const canManage = isSuperuser || hasPermission('can_approve_comments');

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
  const [memberFilterId, setMemberFilterId] = useState(searchParams.get('member') || '');
  const [memberFilterName, setMemberFilterName] = useState(searchParams.get('name') || '');

  // Unified detail modal — viewing, editing, approving and rejecting all happen here.
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<CommentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editText, setEditText] = useState('');
  const [editRating, setEditRating] = useState('0');
  const [savingEdit, setSavingEdit] = useState(false);
  const [statusActionLoading, setStatusActionLoading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  function load() {
    setLoading(true);
    commentsAPI
      .getList(page, {
        search: appliedSearch || undefined,
        status: statusFilter || undefined,
        target_type: targetFilter || undefined,
        author: memberFilterId || undefined,
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
  }, [canManage, page, appliedSearch, statusFilter, targetFilter, memberFilterId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  function clearMemberFilter() {
    setMemberFilterId('');
    setMemberFilterName('');
    setPage(1);
    router.replace(`/${locale}/admin/comments`);
  }

  async function openDetail(c: Comment) {
    setDetailModalOpen(true);
    setDetailLoading(true);
    setDetailItem(null);
    setRejecting(false);
    setRejectReason('');
    try {
      const res = await commentsAPI.getDetail(c.id);
      const d = res.data as unknown as CommentDetail;
      setDetailItem(d);
      setEditText(d.text);
      setEditRating(String(d.rating || 0));
    } catch {
      showToast('error', isRTL ? 'بارگذاری جزئیات ناموفق بود' : 'Failed to load details');
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  async function saveEdit() {
    if (!detailItem) return;
    if (!editText.trim()) {
      showToast('warning', isRTL ? 'متن نظر را وارد کنید' : 'Enter the comment text');
      return;
    }
    setSavingEdit(true);
    try {
      const res = await commentsAPI.update(detailItem.id, {
        text: editText.trim(),
        rating: parseInt(editRating, 10) || null,
      });
      setDetailItem(res.data as unknown as CommentDetail);
      showToast('success', isRTL ? 'تغییرات ذخیره شد' : 'Changes saved');
      load();
    } catch {
      showToast('error', isRTL ? 'ذخیره تغییرات ناموفق بود' : 'Failed to save changes');
    } finally {
      setSavingEdit(false);
    }
  }

  async function approve() {
    if (!detailItem) return;
    setStatusActionLoading(true);
    try {
      const res = await commentsAPI.updateStatus(detailItem.id, 'approved');
      setDetailItem(res.data as unknown as CommentDetail);
      showToast('success', isRTL ? 'نظر تأیید شد' : 'Comment approved');
      load();
    } catch {
      showToast('error', isRTL ? 'انجام عملیات ناموفق بود' : 'Action failed');
    } finally {
      setStatusActionLoading(false);
    }
  }

  async function confirmReject() {
    if (!detailItem) return;
    setStatusActionLoading(true);
    try {
      const res = await commentsAPI.update(detailItem.id, {
        status: 'rejected',
        rejection_reason: rejectReason.trim(),
      });
      setDetailItem(res.data as unknown as CommentDetail);
      showToast('success', isRTL ? 'نظر رد شد' : 'Comment rejected');
      setRejecting(false);
      setRejectReason('');
      load();
    } catch {
      showToast('error', isRTL ? 'انجام عملیات ناموفق بود' : 'Action failed');
    } finally {
      setStatusActionLoading(false);
    }
  }

  if (!canManage) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'شما دسترسی مدیریت نظرات را ندارید.' : 'You do not have permission to manage comments.'}
      </div>
    );
  }

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
        <button
          onClick={() => openDetail(c)}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
          style={{ border: '1px solid rgba(0,255,255,0.25)', color: '#00ffff', backgroundColor: 'rgba(0,255,255,0.06)' }}
          aria-label={isRTL ? 'جزئیات' : 'Details'}
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-white">{isRTL ? 'نظرات' : 'Comments'}</h1>
        <p className="text-sm text-white/40 mt-1">{isRTL ? 'بررسی، ویرایش و تأیید نظرات کاربران' : 'Review, edit, and moderate user comments'}</p>
      </div>

      {memberFilterId && (
        <div className="admin-glass-card p-3 flex items-center justify-between gap-3" style={{ border: '1px solid rgba(0,255,255,0.25)' }}>
          <span className="text-sm text-white/70">
            {isRTL ? `نمایش نظرات عضو: ${memberFilterName || memberFilterId}` : `Showing comments for member: ${memberFilterName || memberFilterId}`}
          </span>
          <button onClick={clearMemberFilter} className="text-xs font-medium underline" style={{ color: '#00ffff' }}>
            {isRTL ? 'پاک‌کردن فیلتر' : 'Clear filter'}
          </button>
        </div>
      )}

      <div className="admin-glass-card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <AdminInput label={isRTL ? 'جست‌وجو' : 'Search'} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} maxLength={150} />
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
      </div>

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

      {/* Unified detail modal — view, edit, approve and reject all happen here */}
      <AdminModal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title={isRTL ? 'جزئیات نظر' : 'Comment Details'} maxWidth="max-w-2xl">
        {detailLoading || !detailItem ? (
          <div className="py-8 text-center text-white/40 text-sm">{isRTL ? 'در حال بارگذاری...' : 'Loading...'}</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'نویسنده' : 'Author'}</span>
                <span className="text-white/80 text-sm">
                  {detailItem.author_label || detailItem.guest_name || (isRTL ? 'مهمان' : 'Guest')}
                  {detailItem.author?.member_number && (
                    <span className="text-white/40 text-xs"> (#{detailItem.author.member_number})</span>
                  )}
                </span>
              </div>
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'هدف نظر' : 'Target'}</span>
                <span className="text-white/80 text-sm">
                  {detailItem.target_type === 'post' ? (isRTL ? 'پست' : 'Post') : (isRTL ? 'هزینه' : 'Expense')}
                  {detailItem.target_label ? `: ${detailItem.target_label}` : ''}
                </span>
              </div>
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'کد پیگیری' : 'Tracking Code'}</span>
                <span className="text-white/80 text-sm font-mono">{detailItem.tracking_code}</span>
              </div>
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'وضعیت' : 'Status'}</span>
                <AdminBadge status={detailItem.status} />
              </div>
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'تاریخ ایجاد' : 'Created'}</span>
                <span className="text-white/60 text-xs">{new Date(detailItem.created_at).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}</span>
              </div>
            </div>

            <AdminTextarea label={isRTL ? 'متن نظر' : 'Comment Text'} value={editText} onChange={(e) => setEditText(e.target.value)} rows={4} maxLength={550} />
            <AdminSelect label={isRTL ? 'امتیاز' : 'Rating'} value={editRating} onChange={(e) => setEditRating(e.target.value)} options={RATING_OPTIONS(isRTL)} />

            <div>
              <button
                type="button"
                onClick={saveEdit}
                disabled={savingEdit}
                className="rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
                style={{ backgroundColor: '#00ffff', color: '#0a0a0f', boxShadow: '0 0 16px rgba(0,255,255,0.3)' }}
              >
                {savingEdit ? (isRTL ? 'در حال ذخیره...' : 'Saving...') : (isRTL ? 'ذخیره متن و امتیاز' : 'Save text & rating')}
              </button>
            </div>

            {detailItem.status === 'rejected' && detailItem.rejection_reason && (
              <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(239,68,68,0.25)', backgroundColor: 'rgba(239,68,68,0.05)' }}>
                <span className="block text-xs mb-1" style={{ color: '#ef4444' }}>{isRTL ? 'دلیل رد' : 'Rejection Reason'}</span>
                <p className="text-white/70 text-sm">{detailItem.rejection_reason}</p>
              </div>
            )}

            {/* Status can always be changed here, even after a prior approve/reject —
                an admin may have clicked the wrong action and needs to correct it. */}
            <div className="flex flex-col gap-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {rejecting ? (
                <>
                  <AdminTextarea
                    label={isRTL ? 'دلیل رد (اختیاری)' : 'Rejection reason (optional)'}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    maxLength={550}
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={confirmReject}
                      disabled={statusActionLoading}
                      className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
                      style={{ border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.06)' }}
                    >
                      <X className="w-4 h-4" />
                      {isRTL ? 'تأیید رد' : 'Confirm Reject'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRejecting(false); setRejectReason(''); }}
                      className="rounded-xl px-5 py-2.5 text-sm font-medium text-white/60 hover:text-white/90 transition-colors"
                    >
                      {isRTL ? 'انصراف' : 'Cancel'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={approve}
                    disabled={statusActionLoading || detailItem.status === 'approved'}
                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
                    style={{ border: '1px solid rgba(16,185,129,0.35)', color: '#10b981', backgroundColor: 'rgba(16,185,129,0.06)' }}
                  >
                    <Check className="w-4 h-4" />
                    {isRTL ? 'تأیید' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting(true)}
                    disabled={statusActionLoading || detailItem.status === 'rejected'}
                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
                    style={{ border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.06)' }}
                  >
                    <X className="w-4 h-4" />
                    {isRTL ? 'رد' : 'Reject'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}
