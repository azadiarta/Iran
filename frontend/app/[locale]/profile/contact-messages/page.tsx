'use client';
import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Mail } from 'lucide-react';
import { contactAPI, ContactMessage, Paginated } from '@/lib/api';
import useAuthStore from '@/store/authStore';

export default function MyContactMessagesPage() {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';
  const { member, isAuthenticated, hasHydrated } = useAuthStore();

  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const pageSize = 5;

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.push(`/${locale}/login`);
    }
  }, [hasHydrated, isAuthenticated, locale, router]);

  const fetchMessages = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const res = await contactAPI.getMine(pageNum);
      const raw = res.data as unknown as Paginated<ContactMessage>;
      setMessages(raw.results || []);
      setTotalCount(raw.count || 0);
      setHasNext(!!raw.next);
      setHasPrev(!!raw.previous);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && member) {
      fetchMessages(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, member?.id]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchMessages(newPage);
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

  const statusStyle = (handled: boolean) =>
    handled
      ? { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' }
      : { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' };

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
          <h1 className="font-bold text-white flex items-center gap-2 text-xl mb-4">
            <Mail className="w-5 h-5 text-white/50" />
            {t('my_messages_title')}
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
          ) : messages.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-6">{t('my_messages_empty')}</p>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => {
                const style = statusStyle(m.is_handled);
                return (
                  <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-white/40">{m.contact_info}</span>
                        <span className="text-xs text-white/40">{formatDate(m.created_at)}</span>
                        <span className="text-xs text-white/30 font-mono">{t('tracking_code_label')}: {m.tracking_code}</span>
                      </div>
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-semibold border flex-shrink-0"
                        style={{ borderColor: style.border, backgroundColor: style.bg, color: style.color }}
                      >
                        {m.is_handled ? t('my_messages_status_handled') : t('my_messages_status_pending')}
                      </span>
                    </div>
                    <p className="text-sm text-white/70 leading-relaxed mt-3 whitespace-pre-wrap">{m.message}</p>
                    {m.is_handled && m.handled_by_label && (
                      <div className="flex items-start gap-2 mt-3 pt-3 border-t border-white/5">
                        <p className="text-sm text-white/60 leading-relaxed">
                          <span className="text-white/40">{t('my_messages_handled_by')}: </span>
                          {m.handled_by_label}
                        </p>
                      </div>
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
