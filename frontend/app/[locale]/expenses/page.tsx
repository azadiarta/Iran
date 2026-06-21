'use client';
import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { User, Calendar, ChevronLeft, ChevronRight, Wallet, Receipt, Search, X } from 'lucide-react';
import { fundAPI } from '@/lib/api';
import type { FundBalance, Expense } from '@/lib/api';
import useAuthStore from '@/store/authStore';
import ImageLightbox from '@/components/common/ImageLightbox';

interface ExpensesResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Expense[];
}

export default function ExpensesPage() {
  const t = useTranslations('expenses');
  const tc = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';
  const { hasPermission } = useAuthStore();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loginRequired, setLoginRequired] = useState(false);
  const [balance, setBalance] = useState<FundBalance | null>(null);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [receiptModal, setReceiptModal] = useState<string | null>(null);

  // Search & filter state
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
  });

  // Debounce filter inputs before refetching
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedFilters({ search, dateFrom, dateTo, amountMin, amountMax });
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, dateFrom, dateTo, amountMin, amountMax]);

  const hasActiveFilters = !!(search || dateFrom || dateTo || amountMin || amountMax);

  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setAmountMin('');
    setAmountMax('');
  };

  // Permissions live in localStorage; gate on mount so SSR and the first
  // client render agree (avoids React hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const canViewBalance = mounted && hasPermission('can_view_balance');
  const pageSize = 5;

  const fetchExpenses = useCallback(
    async (pageNum: number) => {
      setLoadingExpenses(true);
      setLoginRequired(false);
      try {
        const res = await fundAPI.getExpenses(pageNum, {
          search: appliedFilters.search || undefined,
          date_from: appliedFilters.dateFrom || undefined,
          date_to: appliedFilters.dateTo || undefined,
          amount_min: appliedFilters.amountMin || undefined,
          amount_max: appliedFilters.amountMax || undefined,
        });
        const raw = res.data as unknown as ExpensesResponse;
        setExpenses(raw.results || []);
        setTotalCount(raw.count || 0);
        setHasNext(!!raw.next);
        setHasPrev(!!raw.previous);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 403) {
          router.push(`/${locale}/forbidden`);
          return;
        }
        if (status === 401) {
          setLoginRequired(true);
        }
        setExpenses([]);
      } finally {
        setLoadingExpenses(false);
      }
    },
    [locale, router, appliedFilters]
  );

  const fetchBalance = useCallback(async () => {
    if (!canViewBalance) {
      setLoadingBalance(false);
      return;
    }
    setLoadingBalance(true);
    try {
      const res = await fundAPI.getBalance();
      const data = res.data as unknown as FundBalance;
      setBalance(data);
    } catch {
      setBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  }, [canViewBalance]);

  useEffect(() => {
    Promise.all([fetchExpenses(1), fetchBalance()]);
  }, [fetchExpenses, fetchBalance]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchExpenses(newPage);
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
    <div className="min-h-screen text-white">
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Page heading */}
        <h1
          className="text-3xl font-bold mb-8"
          style={{ color: '#00ffff', textShadow: '0 0 20px rgba(0,255,255,0.5)' }}
        >
          {t('title')}
        </h1>

        {/* Balance card */}
        {canViewBalance && (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Wallet className="w-5 h-5" style={{ color: (balance?.balance ?? 0) >= 0 ? '#10b981' : '#ef4444' }} />
              <span className="text-white/60 text-sm">{t('balance_label')}</span>
            </div>
            {loadingBalance ? (
              <div className="animate-pulse">
                <div className="h-10 bg-white/10 rounded-xl w-40" />
              </div>
            ) : balance ? (
              <p
                className="text-4xl font-bold"
                style={{
                  color: balance.balance >= 0 ? '#10b981' : '#ef4444',
                  textShadow: balance.balance >= 0 ? '0 0 16px rgba(16,185,129,0.5)' : '0 0 16px rgba(239,68,68,0.5)',
                }}
              >
                {formatAmount(balance.balance, balance.currency)}
              </p>
            ) : (
              <p className="text-white/40 text-sm">{t('balance_unavailable')}</p>
            )}
          </div>
        )}

        {/* Search & filters */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 mb-6">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search_placeholder')}
              className="w-full rounded-xl pl-11 pr-4 py-2.5 text-white placeholder-white/30 outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <div>
              <label className="block text-xs text-white/40 mb-1">{t('filter_date_from')}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-white outline-none transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">{t('filter_date_to')}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-white outline-none transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">{t('filter_amount_min')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountMin}
                onChange={(e) => setAmountMin(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-white placeholder-white/30 outline-none transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">{t('filter_amount_max')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountMax}
                onChange={(e) => setAmountMax(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-white placeholder-white/30 outline-none transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-3 flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              {t('filters_clear')}
            </button>
          )}
        </div>

        {/* Expenses list */}
        {loadingExpenses ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 animate-pulse"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="h-5 bg-white/10 rounded w-1/3" />
                    <div className="h-4 bg-white/10 rounded w-2/3" />
                  </div>
                  <div className="h-8 bg-white/10 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : loginRequired ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Receipt className="w-12 h-12 text-white/20" />
            <p className="text-white/40 text-lg">{t('login_required')}</p>
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
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Receipt className="w-12 h-12 text-white/20" />
            <p className="text-white/40 text-lg">{t('no_expenses')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {expenses.map((expense) => (
              <Link
                key={expense.id}
                href={`/${locale}/expenses/${expense.id}`}
                className="block rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Receipt thumbnail */}
                  {expense.receipt_image && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setReceiptModal(expense.receipt_image!);
                      }}
                      className="flex-shrink-0 rounded-xl overflow-hidden border border-white/10 hover:border-[#00ffff]/50 transition-colors"
                    >
                      <Image
                        src={expense.receipt_image}
                        alt={t('receipt_label')}
                        width={50}
                        height={50}
                        className="object-cover w-[50px] h-[50px]"
                      />
                    </button>
                  )}

                  {/* Expense info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-bold text-white text-base truncate">
                          {expense.short_reason}
                        </p>
                        {expense.description && (
                          <p className="text-white/50 text-sm truncate mt-0.5">
                            {expense.description}
                          </p>
                        )}
                      </div>
                      <p
                        className="font-bold text-lg flex-shrink-0"
                        style={{ color: '#ef4444', textShadow: '0 0 10px rgba(239,68,68,0.4)' }}
                      >
                        -{formatAmount(expense.amount, balance?.currency ?? '')}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 mt-3 flex-wrap">
                      <span
                        className="flex items-center gap-1.5 text-sm"
                        style={{ color: '#00ffff' }}
                      >
                        <User className="w-3.5 h-3.5" />
                        {expense.withdrawn_by?.display_name || expense.withdrawn_by?.full_name || t('admin_label')}
                      </span>
                      <span className="flex items-center gap-1.5 text-sm text-white/50">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(expense.expense_date)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loadingExpenses && totalCount > pageSize && (
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

      {/* Receipt modal */}
      {receiptModal && (
        <ImageLightbox
          src={receiptModal}
          alt={t('receipt_label')}
          onClose={() => setReceiptModal(null)}
          hintText={tc('lightbox_hint')}
        />
      )}
    </div>
  );
}
