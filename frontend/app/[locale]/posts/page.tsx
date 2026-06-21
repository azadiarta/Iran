'use client';
import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MessageSquare, Calendar, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { postsAPI } from '@/lib/api';
import type { PostSummary, Paginated } from '@/lib/api';
import SiteSearchFilterCard, { SiteFilterField } from '@/components/common/SiteSearchFilterCard';
import { SEARCH_TERM_MAX_LENGTH } from '@/lib/validation';

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonPostCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 space-y-3 h-44">
      <div className="h-5 w-4/5 rounded-lg bg-white/10 animate-pulse" />
      <div className="h-4 w-2/5 rounded-lg bg-white/10 animate-pulse" />
      <div className="h-4 w-1/3 rounded-lg bg-white/10 animate-pulse" />
      <div className="mt-auto h-8 w-28 rounded-lg bg-white/10 animate-pulse" />
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ post, locale, index }: { post: PostSummary; locale: string; index: number }) {
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
    <motion.div
      className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl h-full transition-all duration-200"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,255,255,0.3)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.1)';
      }}
    >
      <Link href={`/${locale}/posts/${post.id}`} className="flex flex-col gap-3 h-full p-6">
        {/* Thumbnail */}
        {post.images && post.images.length > 0 && (
          <div
            className="w-full h-32 rounded-xl overflow-hidden mb-1"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.images[0].image}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Title */}
        <h2
          className="font-bold text-white text-lg leading-snug"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {post.title}
        </h2>

        {/* Meta */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-sm" style={{ color: '#00ffff' }}>
            <User size={13} />
            <span className="truncate">{post.author?.display_name || post.author?.full_name || '—'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <Calendar size={12} />
            <span>{formatDate(post.created_at)}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PostsPage() {
  const t = useTranslations('posts');
  const tc = useTranslations('common');
  const params = useParams();
  const locale = params?.locale as string || 'en';

  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [debouncedDateFrom, setDebouncedDateFrom] = useState('');
  const [debouncedDateTo, setDebouncedDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const pageSize = 5;

  // Debounce search + advanced filters together, same 300ms convention used
  // by every other site search input.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedDateFrom(dateFrom);
      setDebouncedDateTo(dateTo);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, dateFrom, dateTo]);

  const hasActiveFilters = !!(search || dateFrom || dateTo);
  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
  };

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoginRequired(false);
    try {
      const res = await postsAPI.getList(page, {
        search: debouncedSearch,
        date_from: debouncedDateFrom,
        date_to: debouncedDateTo,
      });
      const data = res.data as unknown as Paginated<PostSummary>;
      setPosts(data.results);
      setTotalCount(data.count);
      setHasNext(!!data.next);
      setHasPrev(!!data.previous);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        window.location.href = `/${locale}/forbidden`;
        return;
      }
      if (status === 401) {
        setLoginRequired(true);
        return;
      }
      setError(t('error_loading_list'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, debouncedDateFrom, debouncedDateTo, locale, t]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return (
    <div
      className="min-h-screen px-4 py-12"
      style={{ background: '#0a0a0f' }}
    >
      <div className="max-w-6xl mx-auto">

        {/* Page header */}
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1
            className="text-4xl sm:text-5xl font-black"
            style={{ color: '#00ffff', textShadow: '0 0 20px rgba(0,255,255,0.6)' }}
          >
            {t('title')}
          </h1>
        </motion.div>

        {/* Search & filters — same look as the Expenses page */}
        <motion.div
          className="mb-8 max-w-xl mx-auto"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <SiteSearchFilterCard
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={t('search_placeholder')}
            searchMaxLength={SEARCH_TERM_MAX_LENGTH}
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
            clearLabel={t('filters_clear')}
            filtersClassName="grid grid-cols-2 gap-3 mt-2"
          >
            <SiteFilterField
              label={t('date_from_label')}
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <SiteFilterField
              label={t('date_to_label')}
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </SiteSearchFilterCard>
        </motion.div>

        {/* Error */}
        {error && (
          <div
            className="mb-8 text-center rounded-xl py-4 px-6 max-w-md mx-auto"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444',
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Login required */}
        {loginRequired && (
          <div className="text-center py-20">
            <MessageSquare size={48} className="mx-auto mb-4 text-white/20" />
            <p className="text-white/40 text-lg mb-4">{t('login_required_list')}</p>
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
        )}

        {/* Posts grid */}
        {!error && !loginRequired && (
          <>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonPostCard key={i} />)}
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-20">
                <MessageSquare size={48} className="mx-auto mb-4 text-white/20" />
                <p className="text-white/40 text-lg">{t('no_posts')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map((post, idx) => (
                  <PostCard key={post.id} post={post} locale={locale} index={idx} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {!loading && posts.length > 0 && (
              <div className="flex items-center justify-center gap-4 mt-12">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!hasPrev}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: hasPrev ? '#00ffff' : 'rgba(255,255,255,0.3)',
                  }}
                  onMouseEnter={(e) => {
                    if (hasPrev) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,255,255,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)';
                  }}
                >
                  <ChevronLeft size={16} />
                  {tc('prev')}
                </button>

                <span className="text-white/40 text-sm px-2">
                  {tc('page_info', { page, total: Math.max(1, Math.ceil(totalCount / pageSize)) })}
                </span>

                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasNext}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: hasNext ? '#00ffff' : 'rgba(255,255,255,0.3)',
                  }}
                  onMouseEnter={(e) => {
                    if (hasNext) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,255,255,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)';
                  }}
                >
                  {tc('next')}
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
