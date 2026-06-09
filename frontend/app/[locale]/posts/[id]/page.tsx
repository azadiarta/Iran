'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { User, Calendar, Star, Send, ChevronLeft } from 'lucide-react';
import { postsAPI } from '@/lib/api';
import useAuthStore from '@/store/authStore';
import type { PostDetail, Comment } from '@/lib/api';

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
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star === value ? 0 : star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform duration-100 hover:scale-110 disabled:cursor-not-allowed"
          aria-label={`Rate ${star} out of 10`}
        >
          <Star
            size={16}
            fill={(hover || value) >= star ? '#fbbf24' : 'none'}
            color={(hover || value) >= star ? '#fbbf24' : 'rgba(255,255,255,0.2)'}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-xs text-white/40">{value}/10</span>
      )}
    </div>
  );
}

// ─── Display star rating (read-only) ─────────────────────────────────────────

function StarDisplay({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((star) => (
        <Star
          key={star}
          size={12}
          fill={rating >= star ? '#fbbf24' : 'none'}
          color={rating >= star ? '#fbbf24' : 'rgba(255,255,255,0.15)'}
        />
      ))}
      <span className="ml-1 text-xs text-white/40">{rating}/10</span>
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

// ─── Image Lightbox ───────────────────────────────────────────────────────────

function Lightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <div
        className="relative max-w-4xl max-h-[90vh] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain rounded-xl"
          style={{ maxHeight: '85vh' }}
        />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          aria-label="Close preview"
        >
          ✕
        </button>
        <p className="text-center text-white/30 text-xs mt-2">Click outside or press Esc to close</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PostDetailPage() {
  const t = useTranslations('posts');
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale as string || 'en';
  const postId = params?.id as string;

  const { member, isAuthenticated } = useAuthStore();

  // Post data
  const [post, setPost] = useState<PostDetail | null>(null);
  const [postLoading, setPostLoading] = useState(true);
  const [postError, setPostError] = useState<string | null>(null);

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

  // Pre-fill name from auth
  useEffect(() => {
    if (isAuthenticated && member) {
      setCommentName(member.display_name || member.full_name || '');
    }
  }, [isAuthenticated, member]);

  // Fetch post
  useEffect(() => {
    if (!postId) return;
    setPostLoading(true);
    postsAPI
      .getDetail(postId)
      .then((res) => {
        const data = res.data as unknown as { post: PostDetail; comments: Comment[] };
        setPost(data.post);
      })
      .catch((err: unknown) => {
        if (
          err &&
          typeof err === 'object' &&
          'response' in err &&
          (err as { response?: { status?: number } }).response?.status === 404
        ) {
          setPostError(t('not_found'));
        } else {
          setPostError(t('error_loading_detail'));
        }
      })
      .finally(() => setPostLoading(false));
  }, [postId, t]);

  // Fetch comments
  useEffect(() => {
    if (!postId) return;
    setCommentsLoading(true);
    postsAPI
      .getComments(postId)
      .then((res) => {
        const data = res.data as unknown as Comment[];
        setComments(data.filter((c) => c.is_approved));
      })
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [postId]);

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

    setCommentSubmitting(true);
    try {
      const payload: { text: string; rating?: number; guest_name?: string } = {
        text: commentText.trim(),
      };
      if (commentRating > 0) payload.rating = commentRating;
      if (!isAuthenticated && commentName.trim()) {
        payload.guest_name = commentName.trim();
      }

      await postsAPI.createComment(postId, payload);
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
          res.data?.message || res.data?.detail || 'Failed to submit comment.'
        );
      } else {
        setCommentError(t('comment_submit_error'));
      }
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

  // Loading state
  if (postLoading) {
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

  // Error state
  if (postError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0a0f' }}>
        <div className="text-center space-y-4">
          <p style={{ color: '#ef4444' }} className="text-xl">{postError}</p>
          <button
            onClick={() => router.push(`/${locale}/posts`)}
            className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
          >
            <ChevronLeft size={16} />
            {t('back_to_posts')}
          </button>
        </div>
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="min-h-screen px-4 py-12" style={{ background: '#0a0a0f' }}>
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Back button */}
        <button
          onClick={() => router.push(`/${locale}/posts`)}
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/80 transition-colors duration-200"
        >
          <ChevronLeft size={16} />
          {t('back_to_posts')}
        </button>

        {/* Post container */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 space-y-6">

          {/* Header */}
          <div className="space-y-4">
            <h1
              className="text-3xl sm:text-4xl font-black text-white leading-tight"
            >
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5" style={{ color: '#00ffff' }}>
                <User size={14} />
                <span>{post.author?.display_name || '—'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/50">
                <Calendar size={14} />
                <span>{formatDate(post.created_at)}</span>
              </div>
              {post.updated_at !== post.created_at && (
                <div className="text-white/30 text-xs">
                  {t('updated_label', { date: formatDate(post.updated_at) })}
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

          {/* Body */}
          <div
            className="text-white/80 leading-relaxed text-base"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {post.body}
          </div>

          {/* Image gallery */}
          {post.images && post.images.length > 0 && (
            <div className="space-y-3">
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
              <div className="grid grid-cols-3 gap-3">
                {post.images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setLightboxSrc(img.image)}
                    className="relative aspect-square rounded-xl overflow-hidden transition-all duration-200 hover:ring-2 hover:ring-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                    aria-label={`${post.title} — ${idx + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.image}
                      alt={`${post.title} — ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Lightbox */}
        {lightboxSrc && (
          <Lightbox
            src={lightboxSrc}
            alt={post.title}
            onClose={() => setLightboxSrc(null)}
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
                    placeholder={isAuthenticated ? (member?.display_name || member?.full_name || '') : 'Your name'}
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
                    {t('comment_rating')}
                  </label>
                  <StarRating
                    value={commentRating}
                    onChange={setCommentRating}
                    disabled={commentSubmitting}
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
                  disabled={commentSubmitting}
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
                      Submitting…
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
