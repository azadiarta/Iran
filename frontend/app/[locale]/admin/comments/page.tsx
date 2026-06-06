'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Check, Trash2, AlertTriangle, Star } from 'lucide-react';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';
import AdminBadge from '@/components/admin/AdminBadge';
import { LionAndSun } from '@/components/animations/IranianSymbols';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { dashboardAPI, commentsAPI, DashboardData, Comment } from '@/lib/api';

type ConfirmAction = { type: 'approve' | 'delete'; comment: Comment } | null;

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
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [actionLoading, setActionLoading] = useState(false);

  function load() {
    setLoading(true);
    dashboardAPI
      .getStats()
      .then((res) => {
        const data = res.data as unknown as DashboardData;
        setComments(data.pending_comments || []);
      })
      .catch(() => showToast('error', isRTL ? 'بارگذاری نظرات ناموفق بود' : 'Failed to load comments'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (canApprove) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canApprove]);

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
      setComments((prev) => prev.filter((c) => c.id !== confirmAction.comment.id));
      setConfirmAction(null);
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

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-white">{isRTL ? 'نظرات' : 'Comments'}</h1>
        <p className="text-sm text-white/40 mt-1">{isRTL ? 'بررسی و تأیید نظرات در انتظار' : 'Review and approve pending comments'}</p>
      </div>

      <div
        className="admin-glass-card p-4 flex items-start gap-3 text-sm"
        style={{ border: '1px solid rgba(251,191,36,0.25)', backgroundColor: 'rgba(251,191,36,0.04)' }}
      >
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#fbbf24' }} />
        <p className="text-white/60 text-xs leading-relaxed">
          {isRTL
            ? 'محدودیت بک‌اند: نقطه پایانی سراسری برای فهرست همه نظرات وجود ندارد. این صفحه فقط ۵ نظر اخیرِ در انتظار تأیید را (از طریق داشبورد) نمایش می‌دهد و امکان فیلتر یا صفحه‌بندی ندارد. برای قابلیت کامل، افزودن یک Endpoint سراسری برای نظرات در بک‌اند لازم است.'
            : 'Backend limitation: there is no global comments-list endpoint. This page shows only the 5 most recent pending comments (sourced from the dashboard) with no filtering or pagination. Full functionality requires adding a global comments endpoint to the backend.'}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <LionAndSun size={48} animated />
        </div>
      ) : comments.length === 0 ? (
        <div className="admin-glass-card p-8 text-center text-white/40 text-sm">
          {isRTL ? 'نظر در انتظار تأییدی وجود ندارد' : 'No pending comments'}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <div key={c.id} className="admin-glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white/85">{c.author_label || c.guest_name || (isRTL ? 'مهمان' : 'Guest')}</span>
                  <AdminBadge status={c.is_approved ? 'approved' : 'pending'} />
                  {typeof c.rating === 'number' && c.rating > 0 && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: '#fbbf24' }}>
                      <Star className="w-3.5 h-3.5" fill="#fbbf24" />
                      {c.rating}
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/60 mt-1 break-words">{c.text}</p>
                <p className="text-xs text-white/30 mt-1">{new Date(c.created_at).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setConfirmAction({ type: 'approve', comment: c })}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                  style={{ border: '1px solid rgba(16,185,129,0.35)', color: '#10b981', backgroundColor: 'rgba(16,185,129,0.06)' }}
                >
                  <Check className="w-3.5 h-3.5" />
                  {isRTL ? 'تأیید' : 'Approve'}
                </button>
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
            </div>
          ))}
        </div>
      )}

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
