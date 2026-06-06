'use client';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { SearchX, Home } from 'lucide-react';

export default function NotFoundPage() {
  const t = useTranslations('errors');
  const params = useParams();
  const locale = (params?.locale as string) || 'en';

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 flex flex-col items-center gap-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              backgroundColor: 'rgba(0,255,255,0.1)',
              boxShadow: '0 0 24px rgba(0,255,255,0.25)',
            }}
          >
            <SearchX className="w-8 h-8" style={{ color: '#00ffff' }} />
          </div>

          <h1
            className="text-2xl font-bold"
            style={{ color: '#00ffff', textShadow: '0 0 20px rgba(0,255,255,0.4)' }}
          >
            {t('not_found_title')}
          </h1>

          <p className="text-sm text-white/60">{t('not_found_msg')}</p>

          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2 mt-2 px-6 py-3 rounded-xl font-bold text-sm transition-all"
            style={{
              backgroundColor: '#00ffff',
              color: '#0a0a0f',
              boxShadow: '0 0 24px rgba(0,255,255,0.3)',
            }}
          >
            <Home className="w-4 h-4" />
            {t('back_home')}
          </Link>
        </div>
      </div>
    </div>
  );
}
