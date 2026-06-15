'use client';
import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, HeartHandshake, MessageSquare } from 'lucide-react';
import { fundAPI } from '@/lib/api';
import type { ContributionPublic } from '@/lib/api';

interface ContributionsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ContributionPublic[];
}

export default function ContributionsPage() {
  const t = useTranslations('contributions');
  const params = useParams();
  const locale = (params?.locale as string) || 'en';

  const [items, setItems] = useState<ContributionPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const pageSize = 5;

  const fetchContributions = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const res = await fundAPI.getContributionsPublic(pageNum);
      const raw = res.data as unknown as ContributionsResponse;
      setItems(raw.results || []);
      setTotalCount(raw.count || 0);
      setHasNext(!!raw.next);
      setHasPrev(!!raw.previous);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContributions(1);
  }, [fetchContributions]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchContributions(newPage);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(
        locale === 'fa' ? 'fa-IR' : 'en-GB',
        { year: 'numeric', month: 'short', day: 'numeric' }
      );
    } catch {
      return dateStr;
    }
  };

  const formatAmount = (amount: number, currency: string) => {
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
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Page heading */}
        <div className="mb-8">
          <h1
            className="text-3xl font-bold"
            style={{ color: '#00ffff', textShadow: '0 0 20px rgba(0,255,255,0.5)' }}
          >
            {t('title')}
          </h1>
          <p className="text-sm text-white/40 mt-2">{t('subtitle')}</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 animate-pulse"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="h-5 bg-white/10 rounded w-1/3" />
                  <div className="h-5 bg-white/10 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <HeartHandshake className="w-12 h-12 text-white/20" />
            <p className="text-white/40 text-lg">{t('no_contributions')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <span className="font-bold text-white text-base">
                    {c.display_name || t('anonymous')}
                  </span>
                  <span
                    className="font-bold text-lg flex-shrink-0"
                    style={{ color: '#10b981', textShadow: '0 0 10px rgba(16,185,129,0.4)' }}
                  >
                    {formatAmount(c.amount, c.currency)}
                  </span>
                </div>
                <p className="text-sm text-white/40 mt-1">{formatDate(c.created_at)}</p>
                {c.message && (
                  <div className="flex items-start gap-2 mt-3 pt-3 border-t border-white/5">
                    <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5 text-white/30" />
                    <p className="text-sm text-white/60 leading-relaxed">{c.message}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalCount > pageSize && (
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={!hasPrev}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white"
            >
              <ChevronLeft className="w-4 h-4" />
              {t('prev')}
            </button>

            <span className="text-white/50 text-sm">
              {t('page_info', { page, total: Math.ceil(totalCount / pageSize) })}
            </span>

            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={!hasNext}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white"
            >
              {t('next')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
