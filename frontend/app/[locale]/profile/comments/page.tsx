'use client';
import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, MessageSquare, AlertTriangle, Star, Pencil, Save, X } from 'lucide-react';
import { commentsAPI, MyComment, Paginated } from '@/lib/api';
import useAuthStore from '@/store/authStore';
import { useTransientError } from '@/hooks/useFieldFeedback';

const STATUS_STYLE: Record<MyComment['status'], { color: string; bg: string; border: string }> = {
  pending: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
  approved: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
  rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
};

export default function MyCommentsPage() {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';
  const { member, isAuthenticated, hasHydrated } = useAuthStore();

  const [comments, setComments] = useState<MyComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const pageSize = 5;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editTextError, setEditTextError] = useState<string | null>(null);
  const [editRating, setEditRating] = useState('1');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const editTextFeedback = useTransientError(editTextError || undefined);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.push(`/${locale}/login`);
    }
  }, [hasHydrated, isAuthenticated, locale, router]);

  const fetchComments = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const res = await commentsAPI.getMine(pageNum);
      const raw = res.data as unknown as Paginated<MyComment>;
      setComments(raw.results || []);
      setTotalCount(raw.count || 0);
      setHasNext(!!raw.next);
      setHasPrev(!!raw.previous);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && member) {
      fetchComments(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, member?.id]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchComments(newPage);
  };

  if (!isAuthenticated || !member) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  function targetLabel(c: MyComment) {
    const kind = c.target_type === 'post' ? t('my_comments_target_post') : t('my_comments_target_expense');
    return c.target_label ? `${kind}: ${c.target_label}` : kind;
  }

  function startEdit(c: MyComment) {
    setEditingId(c.id);
    setEditText(c.text);
    setEditTextError(null);
    setEditRating(String(c.rating || 1));
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  function handleEditTextChange(value: string) {
    setEditText(value);
    setEditTextError(value.trim() ? null : t('my_comments_text_required'));
  }

  async function saveEdit() {
    if (!editingId) return;
    if (!editText.trim()) {
      setEditTextError(t('my_comments_text_required'));
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await commentsAPI.updateMine(editingId, {
        text: editText.trim(),
        rating: parseInt(editRating, 10),
      });
      setEditingId(null);
      fetchComments(page);
    } catch {
      setEditError(t('my_comments_save_error'));
    } finally {
      setEditSaving(false);
    }
  }

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 outline-none focus:border-[#00ffff] focus:ring-1 focus:ring-[#00ffff]/30 transition-all';

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <button
          onClick={() => router.push(`/${locale}/profile`)}
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/80 transition-colors duration-200 mb-6"
        >
          <ChevronLeft size={16} />
          {t('back_to_profile')}
        </button>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <h1 className="font-bold text-white flex items-center gap-2 text-xl mb-4">
            <MessageSquare className="w-5 h-5 text-white/50" />
            {t('my_comments_title')}
          </h1>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse">
                  <div className="flex items-center justify-between gap-4">
                    <div className="h-4 bg-white/10 rounded w-1/2" />
                    <div className="h-4 bg-white/10 rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-6">{t('my_comments_empty')}</p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => {
                const style = STATUS_STYLE[c.status];
                const isEditing = editingId === c.id;
                return (
                  <div key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-white/40">{targetLabel(c)}</span>
                        <span className="text-xs text-white/40">{formatDate(c.created_at)}</span>
                        <span className="text-xs text-white/30 font-mono">{t('tracking_code_label')}: {c.tracking_code}</span>
                      </div>
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-semibold border flex-shrink-0"
                        style={{ borderColor: style.border, backgroundColor: style.bg, color: style.color }}
                      >
                        {t(`status_${c.status}`)}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="mt-3 space-y-3">
                        <textarea
                          value={editText}
                          onChange={(e) => handleEditTextChange(e.target.value)}
                          rows={3}
                          maxLength={250}
                          className={inputClass}
                          style={{
                            borderColor:
                              editTextFeedback.status === 'error'
                                ? '#ef4444'
                                : editTextFeedback.status === 'success'
                                ? '#10b981'
                                : 'rgba(255,255,255,0.1)',
                          }}
                        />
                        <div className="flex items-start justify-between gap-2">
                          {editTextFeedback.message ? (
                            <p
                              className="text-xs transition-colors duration-300"
                              style={{ color: editTextFeedback.status === 'success' ? '#10b981' : '#ef4444' }}
                            >
                              {editTextFeedback.message}
                            </p>
                          ) : <span />}
                          <p className="text-xs text-white/30 text-right whitespace-nowrap">{editText.length}/250</p>
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1.5">{t('my_comments_rating_label')}</label>
                          <select value={editRating} onChange={(e) => setEditRating(e.target.value)} className={inputClass}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                        <p className="text-xs text-white/40">{t('my_comments_edit_notice')}</p>
                        {editError && (
                          <div className="flex items-start gap-2 rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-3">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                            <p className="text-sm" style={{ color: '#ef4444' }}>{editError}</p>
                          </div>
                        )}
                        <div className="flex gap-3">
                          <button
                            onClick={saveEdit}
                            disabled={editSaving}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                            style={{ backgroundColor: '#00ffff', color: '#0a0a0f' }}
                          >
                            <Save className="w-3.5 h-3.5" />
                            {t('save')}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                            {t('cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-white/70 leading-relaxed mt-3 whitespace-pre-wrap">{c.text}</p>
                        {typeof c.rating === 'number' && c.rating > 0 && (
                          <div className="flex items-center gap-1 mt-2" style={{ color: '#fbbf24' }}>
                            {[...Array(c.rating)].map((_, i) => (
                              <Star key={i} className="w-3.5 h-3.5" fill="#fbbf24" />
                            ))}
                          </div>
                        )}
                        {c.status === 'rejected' && c.rejection_reason && (
                          <div className="flex items-start gap-2 mt-3 pt-3 border-t border-white/5">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                            <p className="text-sm text-white/60 leading-relaxed">
                              <span className="text-white/40">{t('my_comments_rejection_reason')}: </span>
                              {c.rejection_reason}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
                          <button
                            onClick={() => startEdit(c)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={{ border: '1px solid rgba(0,255,255,0.25)', color: '#00ffff', backgroundColor: 'rgba(0,255,255,0.06)' }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            {t('edit')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && totalCount > pageSize && (
            <div className="flex items-center justify-between mt-5">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={!hasPrev}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                {tc('prev')}
              </button>

              <span className="text-white/50 text-sm">
                {tc('page_info', { page, total: Math.ceil(totalCount / pageSize) })}
              </span>

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={!hasNext}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white text-sm"
              >
                {tc('next')}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
