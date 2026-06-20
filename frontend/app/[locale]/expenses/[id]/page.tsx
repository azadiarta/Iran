'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { User, Calendar, Star, Send, ChevronLeft } from 'lucide-react';
import { fundAPI } from '@/lib/api';
import useAuthStore from '@/store/authStore';
import ImageLightbox from '@/components/common/ImageLightbox';
import Turnstile from '@/components/common/Turnstile';
import type { Expense, FundBalance, Comment } from '@/lib/api';

// ─── Star Rating Selector ─────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: 5 }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star === value ? 0 : star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform duration-100 hover:scale-110 disabled:cursor-not-allowed"
          aria-label={`Rate ${star} out of 5`}
        >
          <Star
            size={22}
            fill={(hover || value) >= star ? '#fbbf24' : 'none'}
            color={(hover || value) >= star ? '#fbbf24' : 'rgba(255,255,255,0.2)'}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-xs text-white/40">{value}/5</span>
      )}
    </div>
  );
}

// ─── Display star rating (read-only) ─────────────────────────────────────────

function StarDisplay({ rating }: { rating: number | null }) {
  if (!rating) return null;
  const filled = Math.min(rating, 5);
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: 5 }, (_, i) => i + 1).map((star) => (
        <Star
          key={star}
          size={18}
          fill={filled >= star ? '#fbbf24' : 'none'}
          color={filled >= star ? '#fbbf24' : 'rgba(255,255,255,0.15)'}
        />
      ))}
      <span className="ml-1 text-xs text-white/40">{filled}/5</span>
    </div>
  );
}

// ─── Comment item ─────────────────────────────────────────────────────────────

function CommentItem({ comment, locale, t }: { comment: Comment; locale: string; t: ReturnType<typeof useTranslations> }) {
  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-GB', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,255,255,0.1)', color: '#00ffff' }}
          >
            <User size={14} />
          </div>
          <span className="text-sm font-medium text-white">{comment.author_label || t('anonymous')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/40">
          <Calendar size={11} />
          {formatDate(comment.created_at)}
        </div>
      </div>

      {comment.rating !== null && <StarDisplay rating={comment.rating} />}

      <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{comment.text}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExpenseDetailPage() {
  const t = useTranslations('expenses');
  const tc = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale as string || 'en';
  const expenseId = params?.id as string;

  const { member, isAuthenticated, hasPermission } = useAuthStore();

  // Permissions live in localStorage; gate on mount so SSR and the first
  // client render agree (avoids React hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const canViewBalance = mounted && hasPermission('can_view_balance');

  // Expense data
  const [expense, setExpense] = useState<Expense | null>(null);
  const [expenseLoading, setExpenseLoading] = useState(true);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [expenseLoginRequired, setExpenseLoginRequired] = useState(false);

  // Currency (for amount formatting)
  const [balance, setBalance] = useState<FundBalance | null>(null);

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);

  // Lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Comment form
  const [commentName, setCommentName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentRating, setCommentRating] = useState(0);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentSuccess, setCommentSuccess] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  // Pre-fill name from auth
  useEffect(() => {
    if (isAuthenticated && member) {
      setCommentName(member.display_name || member.full_name || '');
    }
  }, [isAuthenticated, member]);

  // Fetch expense
  useEffect(() => {
    if (!expenseId) return;
    setExpenseLoading(true);
    fundAPI
      .getExpenseDetail(expenseId)
      .then((res) => {
        const data = res.data as unknown as Expense;
        setExpense(data);
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          setExpenseError(t('not_found'));
        } else if (status === 401) {
          setExpenseLoginRequired(true);
        } else if (status === 403) {
          router.push(`/${locale}/forbidden`);
        } else {
          setExpenseError(t('error_loading_detail'));
        }
      })
      .finally(() => setExpenseLoading(false));
  }, [expenseId, locale, router, t]);

  // Fetch balance (for currency formatting)
  useEffect(() => {
    if (!canViewBalance) return;
    fundAPI
      .getBalance()
      .then((res) => {
        const data = res.data as unknown as FundBalance;
        setBalance(data);
      })
      .catch(() => setBalance(null));
  }, [canViewBalance]);

  // Fetch comments
  useEffect(() => {
    if (!expenseId) return;
    setCommentsLoading(true);
    fundAPI
      .getExpenseComments(expenseId)
      .then((res) => {
        const data = res.data as unknown as Comment[];
        setComments(data.filter((c) => c.status === 'approved'));
      })
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [expenseId]);

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCommentError('');

    if (!commentText.trim()) {
      setCommentError(t('comment_text_required'));
      return;
    }
    if (!isAuthenticated && !commentName.trim()) {
      setCommentError(t('name_required'));
      return;
    }
    if (commentRating === 0) {
      setCommentError(t('comment_rating_required'));
      return;
    }
    if (!captchaToken) {
      setCommentError(tc('captcha_required_error'));
      return;
    }

    setCommentSubmitting(true);
    try {
      const payload: { text: string; rating: number; guest_name?: string; captcha_token: string } = {
        text: commentText.trim(),
        rating: commentRating,
        captcha_token: captchaToken,
      };
      if (!isAuthenticated && commentName.trim()) {
        payload.guest_name = commentName.trim();
      }

      await fundAPI.createExpenseComment(expenseId, payload);
      setCommentSuccess(true);
      setCommentText('');
      setCommentRating(0);
      if (!isAuthenticated) setCommentName('');
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response
      ) {
        const res = (err as { response: { data: { message?: string; detail?: string } } }).response;
        setCommentError(
          res.data?.message || res.data?.detail || t('comment_submit_error')
        );
      } else {
        setCommentError(t('comment_submit_error'));
      }
      setCaptchaToken('');
      setCaptchaResetKey((k) => k + 1);
    } finally {
      setCommentSubmitting(false);
    }
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-GB', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch {
      return iso;
    }
  }

  function formatAmount(amount: number, currency: string) {
    const symbol =
      currency === 'GBP'
        ? '£'
        : currency === 'USD'
          ? '$'
          : currency === 'EUR'
            ? '€'
            : currency + ' ';
    return `${symbol}${Number(amount).toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  // Loading state
  if (expenseLoading) {
    return (
      <div className="min-h-screen px-4 py-12" style={{ background: '#0a0a0f' }}>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="h-8 w-24 rounded-lg bg-white/10 animate-pulse" />
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 space-y-4">
            <div className="h-8 w-3/4 rounded-lg bg-white/10 animate-pulse" />
            <div className="h-4 w-1/3 rounded-lg bg-white/10 animate-pulse" />
            <div className="h-4 w-1/4 rounded-lg bg-white/10 animate-pulse" />
            <div className="space-y-2 pt-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-4 rounded-lg bg-white/10 animate-pulse" style={{ width: `${70 + (i % 3) * 10}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Login required state
  if (expenseLoginRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0a0f' }}>
        <div className="text-center space-y-4">
          <p className="text-white/40 text-xl">{t('login_required_detail')}</p>
          <Link
            href={`/${locale}/login`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all"
            style={{
              backgroundColor: '#00ffff',
              color: '#0a0a0f',
              boxShadow: '0 0 24px rgba(0,255,255,0.3)',
            }}
          >
            {t('login_cta')}
          </Link>
        </div>
      </div>
    );
  }

  // Error state
  if (expenseError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0a0f' }}>
        <div className="text-center space-y-4">
          <p style={{ color: '#ef4444' }} className="text-xl">{expenseError}</p>
          <button
            onClick={() => router.push(`/${locale}/expenses`)}
            className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
          >
            <ChevronLeft size={16} />
            {t('back_to_expenses')}
          </button>
        </div>
      </div>
    );
  }

  if (!expense) return null;

  return (
    <div className="min-h-screen px-4 py-12" style={{ background: '#0a0a0f' }}>
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Back button */}
        <button
          onClick={() => router.push(`/${locale}/expenses`)}
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/80 transition-colors duration-200"
        >
          <ChevronLeft size={16} />
          {t('back_to_expenses')}
        </button>

        {/* Expense container */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 space-y-6">

          {/* Header */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                {expense.short_reason}
              </h1>
              <p
                className="font-bold text-3xl flex-shrink-0"
                style={{ color: '#10b981', textShadow: '0 0 16px rgba(16,185,129,0.5)' }}
              >
                {formatAmount(expense.amount, balance?.currency ?? '')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5" style={{ color: '#00ffff' }}>
                <User size={14} />
                <span className="text-white/40">{t('withdrawn_by_label')}:</span>
                <span>{expense.withdrawn_by?.display_name || expense.withdrawn_by?.full_name || t('admin_label')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/50">
                <Calendar size={14} />
                <span>{formatDate(expense.expense_date)}</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

          {/* Description */}
          {expense.description && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide">
                {t('description_label')}
              </h2>
              <div
                className="text-white/80 leading-relaxed text-base"
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {expense.description}
              </div>
            </div>
          )}

          {/* Receipt image */}
          {expense.receipt_image && (() => {
            const receiptUrl = expense.receipt_image as string;
            return (
              <div className="space-y-3">
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
                <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide">
                  {t('receipt_label')}
                </h2>
                <button
                  type="button"
                  onClick={() => setLightboxSrc(receiptUrl)}
                  className="relative w-40 h-40 rounded-xl overflow-hidden transition-all duration-200 hover:ring-2 hover:ring-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                  aria-label={t('receipt_label')}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={receiptUrl}
                    alt={t('receipt_label')}
                    className="w-full h-full object-cover"
                  />
                </button>
              </div>
            );
          })()}
        </div>

        {/* Lightbox */}
        {lightboxSrc && (
          <ImageLightbox
            src={lightboxSrc}
            alt={t('receipt_label')}
            onClose={() => setLightboxSrc(null)}
            hintText={tc('lightbox_hint')}
          />
        )}

        {/* Comments Section */}
        <div className="space-y-6">
          <h2
            className="text-2xl font-bold"
            style={{ color: '#00ffff', textShadow: '0 0 10px rgba(0,255,255,0.5)' }}
          >
            {t('comments_title')}
          </h2>

          {/* Comment list */}
          {commentsLoading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3 animate-pulse"
                >
                  <div className="h-4 w-1/3 rounded bg-white/10" />
                  <div className="h-4 w-2/3 rounded bg-white/10" />
                  <div className="h-4 w-1/2 rounded bg-white/10" />
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <p className="text-white/30 text-sm py-4">{t('no_comments')}</p>
          ) : (
            <div className="space-y-4">
              {comments.map((c) => (
                <CommentItem key={c.id} comment={c} locale={locale} t={t} />
              ))}
            </div>
          )}

          {/* Add Comment Form */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 space-y-5">
            <h3
              className="text-lg font-bold"
              style={{ color: '#00ffff' }}
            >
              {t('add_comment')}
            </h3>

            {commentSuccess ? (
              <div
                className="rounded-xl px-4 py-3 text-sm font-medium"
                style={{
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  color: '#10b981',
                }}
                role="status"
              >
                {t('comment_pending')}
              </div>
            ) : (
              <form onSubmit={handleCommentSubmit} noValidate className="space-y-4">

                {/* Name */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="comment-name"
                    className="block text-sm font-medium text-white/70"
                  >
                    {t('comment_name')}
                  </label>
                  <input
                    id="comment-name"
                    type="text"
                    value={commentName}
                    onChange={(e) => setCommentName(e.target.value)}
                    readOnly={isAuthenticated}
                    disabled={commentSubmitting}
                    placeholder={isAuthenticated ? (member?.display_name || member?.full_name || '') : t('comment_name_placeholder')}
                    maxLength={50}
                    className="w-full rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none transition-all duration-200 disabled:opacity-50"
                    style={{
                      background: isAuthenticated
                        ? 'rgba(255,255,255,0.03)'
                        : 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      cursor: isAuthenticated ? 'default' : 'text',
                    }}
                    onFocus={(e) => {
                      if (!isAuthenticated) {
                        e.currentTarget.style.border = '1px solid #00ffff';
                        e.currentTarget.style.boxShadow = '0 0 10px rgba(0,255,255,0.15)';
                      }
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Text */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="comment-text"
                    className="block text-sm font-medium text-white/70"
                  >
                    {t('comment_text')}
                  </label>
                  <textarea
                    id="comment-text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    disabled={commentSubmitting}
                    placeholder={t('comment_text')}
                    rows={4}
                    maxLength={250}
                    className="w-full rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none transition-all duration-200 disabled:opacity-50 resize-y"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      minHeight: '100px',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.border = '1px solid #00ffff';
                      e.currentTarget.style.boxShadow = '0 0 10px rgba(0,255,255,0.15)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Rating */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-white/70">
                    {t('comment_rating')} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <StarRating
                    value={commentRating}
                    onChange={setCommentRating}
                    disabled={commentSubmitting}
                  />
                </div>

                {/* CAPTCHA */}
                <div className="flex justify-center">
                  <Turnstile
                    onVerify={setCaptchaToken}
                    onExpire={() => setCaptchaToken('')}
                    resetKey={captchaResetKey}
                  />
                </div>

                {/* Error */}
                {commentError && (
                  <p
                    className="text-sm rounded-lg px-3 py-2"
                    style={{
                      color: '#ef4444',
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                    }}
                    role="alert"
                  >
                    {commentError}
                  </p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={commentSubmitting || !captchaToken}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: 'rgba(0,255,255,0.1)',
                    border: '1px solid #00ffff',
                    color: '#00ffff',
                  }}
                  onMouseEnter={(e) => {
                    if (!commentSubmitting) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,255,0.2)';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 15px rgba(0,255,255,0.25)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,255,0.1)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                  }}
                >
                  {commentSubmitting ? (
                    <>
                      <svg
                        className="animate-spin"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      {tc('submitting')}
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      {t('comment_submit')}
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
