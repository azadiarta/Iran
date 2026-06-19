'use client';
import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, HeartHandshake, MessageSquare, AlertTriangle } from 'lucide-react';
import { fundAPI, MyContribution, Paginated } from '@/lib/api';
import useAuthStore from '@/store/authStore';

export default function MyContributionsPage() {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';
  const isRTL = locale === 'fa';
  const { member, isAuthenticated, hasHydrated } = useAuthStore();

  const [contributions, setContributions] = useState<MyContribution[]>([]);
  const [contribLoading, setContribLoading] = useState(true);
  const [contribPage, setContribPage] = useState(1);
  const [contribTotalCount, setContribTotalCount] = useState(0);
  const [contribHasNext, setContribHasNext] = useState(false);
  const [contribHasPrev, setContribHasPrev] = useState(false);
  const [totalApproved, setTotalApproved] = useState('0');
  const contribPageSize = 5;

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.push(`/${locale}/login`);
    }
  }, [hasHydrated, isAuthenticated, locale, router]);

  const fetchContributions = useCallback(async (pageNum: number) => {
    setContribLoading(true);
    try {
      const res = await fundAPI.getMyContributions(pageNum);
      const raw = res.data as unknown as Paginated<MyContribution> & { total_approved: string };
      setContributions(raw.results || []);
      setContribTotalCount(raw.count || 0);
      setContribHasNext(!!raw.next);
      setContribHasPrev(!!raw.previous);
      setTotalApproved(raw.total_approved || '0');
    } catch {
      setContributions([]);
    } finally {
      setContribLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && member) {
      fetchContributions(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, member?.id]);

  const handleContribPageChange = (newPage: number) => {
    setContribPage(newPage);
    fetchContributions(newPage);
  };

  if (!isAuthenticated || !member) {
    return null;
  }

  const formatContribDate = (dateStr: string) => {
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

  const formatContribAmount = (amount: number, currency: string) => {
    const symbol =
      currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency + ' ';
    return `${symbol}${Number(amount).toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const contribStatusStyle: Record<MyContribution['status'], { color: string; bg: string; border: string }> = {
    pending: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
    pending_review: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
    completed: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
    failed: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
  };

  // pending = contribution created, awaiting payment; pending_review = a
  // receipt has been uploaded and is awaiting admin verification — distinct
  // stages of the same flow, spelled out so they don't read as duplicates.
  const contribStatusLabel: Record<MyContribution['status'], string> = {
    pending: isRTL ? 'در انتظار پرداخت' : 'Awaiting Payment',
    pending_review: isRTL ? 'در انتظار بررسی رسید' : 'Awaiting Receipt Review',
    completed: isRTL ? 'تکمیل شده' : 'Completed',
    failed: isRTL ? 'رد شده' : 'Rejected',
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <button
          onClick={() => router.push(`/${locale}/profile`)}
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/80 transition-colors duration-200 mb-6"
        >
          <ChevronLeft size={16} />
          {t('back_to_profile')}
        </button>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h1 className="font-bold text-white flex items-center gap-2 text-xl">
              <HeartHandshake className="w-5 h-5 text-white/50" />
              {t('my_contributions_title')}
            </h1>
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold border"
              style={{ borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981' }}
            >
              {t('my_contributions_total_approved')}: {formatContribAmount(Number(totalApproved), 'GBP')}
            </span>
          </div>

          {contribLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse">
                  <div className="flex items-center justify-between gap-4">
                    <div className="h-4 bg-white/10 rounded w-1/3" />
                    <div className="h-4 bg-white/10 rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : contributions.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-6">{t('my_contributions_empty')}</p>
          ) : (
            <div className="space-y-3">
              {contributions.map((c) => {
                const style = contribStatusStyle[c.status];
                return (
                  <div key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-white">
                          {formatContribAmount(c.amount, c.currency)}
                        </span>
                        <span className="text-xs text-white/40">{formatContribDate(c.created_at)}</span>
                        <span className="text-xs text-white/30 font-mono">{t('tracking_code_label')}: {c.tracking_code}</span>
                      </div>
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-semibold border flex-shrink-0"
                        style={{ borderColor: style.border, backgroundColor: style.bg, color: style.color }}
                      >
                        {contribStatusLabel[c.status]}
                      </span>
                    </div>
                    {c.status === 'failed' && c.rejection_reason && (
                      <div className="flex items-start gap-2 mt-3 pt-3 border-t border-white/5">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                        <p className="text-sm text-white/60 leading-relaxed">
                          <span className="text-white/40">{t('my_contributions_rejection_reason')}: </span>
                          {c.rejection_reason}
                        </p>
                      </div>
                    )}
                    {c.message && (
                      <div className="flex items-start gap-2 mt-3 pt-3 border-t border-white/5">
                        <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5 text-white/30" />
                        <p className="text-sm text-white/60 leading-relaxed">{c.message}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!contribLoading && contribTotalCount > contribPageSize && (
            <div className="flex items-center justify-between mt-5">
              <button
                onClick={() => handleContribPageChange(contribPage - 1)}
                disabled={!contribHasPrev}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                {tc('prev')}
              </button>

              <span className="text-white/50 text-sm">
                {tc('page_info', { page: contribPage, total: Math.ceil(contribTotalCount / contribPageSize) })}
              </span>

              <button
                onClick={() => handleContribPageChange(contribPage + 1)}
                disabled={!contribHasNext}
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
