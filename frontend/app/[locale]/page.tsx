'use client';
import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { motion, useInView } from 'framer-motion';
import { Users, TrendingUp, Wallet, ArrowRight, CheckCircle, UserCheck, User, Languages } from 'lucide-react';
import useLangStore from '@/store/langStore';
import {
  LionAndSun,
  HandsEmblem,
  GeometricPattern,
  FaravaharSimple,
  PersepolisIcon,
  PasargadaeIcon,
  NaqsheRostamIcon,
  HafezIcon,
  SaadiIcon,
} from '@/components/animations/IranianSymbols';
import { postsAPI, fundAPI, membersAPI, settingsAPI } from '@/lib/api';
import useAuthStore from '@/store/authStore';
import type { PostSummary, FundBalance } from '@/lib/api';

// ─── Animated count-up hook ──────────────────────────────────────────────────

function useCountUp(target: number, duration: number = 1500, enabled: boolean = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled || target === 0) {
      setValue(target);
      return;
    }
    let start: number | null = null;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      setValue(progress >= 1 ? target : Math.floor(progress * target * 100) / 100);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, enabled]);
  return value;
}

// ─── Section animation wrapper ───────────────────────────────────────────────

function FadeInSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  value,
  label,
  prefix = '',
  loading,
  locale,
}: {
  icon: React.ElementType;
  value: number | string;
  label: string;
  prefix?: string;
  loading: boolean;
  locale: string;
}) {
  const numericValue = typeof value === 'number' ? value : 0;
  const counted = useCountUp(numericValue, 1500, !loading && typeof value === 'number');

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 flex flex-col items-center gap-3">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,255,255,0.1)', color: '#00ffff' }}
      >
        <Icon size={24} />
      </div>
      {loading ? (
        <div className="h-8 w-24 rounded-lg bg-white/10 animate-pulse" />
      ) : (
        <p
          className="text-3xl font-bold"
          style={{ color: '#00ffff', textShadow: '0 0 10px #00ffff' }}
        >
          {typeof value === 'string' ? value : `${prefix}${counted.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US', { maximumFractionDigits: 2 })}`}
        </p>
      )}
      <p className="text-white/60 text-sm text-center">{label}</p>
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonPostCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 space-y-3">
      <div className="h-5 w-3/4 rounded bg-white/10 animate-pulse" />
      <div className="h-4 w-1/2 rounded bg-white/10 animate-pulse" />
      <div className="h-4 w-1/3 rounded bg-white/10 animate-pulse" />
      <div className="h-8 w-28 rounded-lg bg-white/10 animate-pulse mt-4" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LandingPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = params?.locale as string || 'en';
  const { hasPermission, isAuthenticated, member } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const { setLocale } = useLangStore();

  function handleLanguageSwitch() {
    const newLocale = locale === 'en' ? 'fa' : 'en';
    setLocale(newLocale);
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  }

  const [balance, setBalance] = useState<FundBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const [memberCount, setMemberCount] = useState(0);
  const [memberCountLoading, setMemberCountLoading] = useState(true);

  const [heroHeadline, setHeroHeadline] = useState<string | null>(null);
  const [heroTagline, setHeroTagline] = useState<string | null>(null);

  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState(false);
  const [postsLoginRequired, setPostsLoginRequired] = useState(false);

  // Floating geometric patterns positions (stable — computed once)
  const floatingPatterns = useRef([
    { top: '8%', left: '5%', size: 60, rotate: 15 },
    { top: '20%', right: '8%', size: 48, rotate: -20 },
    { top: '55%', left: '3%', size: 56, rotate: 30 },
    { bottom: '25%', right: '4%', size: 44, rotate: -10 },
    { bottom: '10%', left: '15%', size: 52, rotate: 45 },
    { top: '40%', right: '2%', size: 40, rotate: 60 },
  ]).current;

  useEffect(() => {
    fundAPI.getBalance()
      .then((res) => setBalance(res.data as unknown as FundBalance))
      .catch(() => setBalance(null))
      .finally(() => setBalanceLoading(false));

    membersAPI.getPublicCount()
      .then((res) => setMemberCount((res.data as unknown as { count: number }).count))
      .catch(() => setMemberCount(0))
      .finally(() => setMemberCountLoading(false));

    settingsAPI.getPublicSettings().then((res) => {
      const results = res?.data as unknown as { key: string; value: string }[] | undefined;
      if (!Array.isArray(results)) return;
      const headlineKey = locale === 'fa' ? 'landing_headline_fa' : 'landing_headline_en';
      const taglineKey = locale === 'fa' ? 'landing_tagline_fa' : 'landing_tagline_en';
      const headline = results.find((s) => s.key === headlineKey);
      const tagline = results.find((s) => s.key === taglineKey);
      if (headline?.value) setHeroHeadline(headline.value);
      if (tagline?.value) setHeroTagline(tagline.value);
    });

    postsAPI.getList(1)
      .then((res) => setPosts((res.data as unknown as { results: PostSummary[] }).results.slice(0, 3)))
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          setPostsLoginRequired(true);
        } else {
          setPostsError(true);
        }
      })
      .finally(() => setPostsLoading(false));
  }, []);

  // Permissions live in localStorage; gate on mount so SSR and the first
  // client render agree (avoids React hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const canViewBalance = mounted && hasPermission('can_view_balance');

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
    <div style={{ minHeight: '100vh' }}>

      {/* ─── Deactivated account banner ───────────────────────────────────── */}
      {mounted && member?.is_active === false && (
        <div className="px-4 pt-4 relative z-10">
          <div
            className="max-w-3xl mx-auto rounded-xl border p-4 text-sm text-center space-y-1"
            style={{
              borderColor: 'rgba(245,158,11,0.3)',
              backgroundColor: 'rgba(245,158,11,0.08)',
              color: '#f59e0b',
            }}
          >
            <p className="font-semibold">{t('common.deactivated_title')}</p>
            <p>{t('common.deactivated_message')}</p>
            {member?.deactivation_reason && (
              <p>
                <span className="font-semibold">{t('common.deactivated_reason_label')}: </span>
                {member.deactivation_reason}
              </p>
            )}
            {member?.deactivated_by_name && (
              <p>
                <span className="font-semibold">{t('common.deactivated_by_label')}: </span>
                {member.deactivated_by_name}
              </p>
            )}
            <Link href={`/${locale}/contact`} className="underline inline-block">
              {t('common.deactivated_contact_link')}
            </Link>
          </div>
        </div>
      )}

      {/* ─── Hero Section ─────────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden"
        style={{ minHeight: '100vh' }}
      >
        {/* Background: LionAndSun centered */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          aria-hidden="true"
        >
          <div style={{ color: '#fbbf24', opacity: 0.15 }}>
            <LionAndSun size={280} />
          </div>
        </div>

        {/* Background: floating geometric patterns */}
        {floatingPatterns.map((p, i) => (
          <motion.div
            key={i}
            className="absolute pointer-events-none select-none"
            style={{ color: '#fbbf24', opacity: 0.10, ...p }}
            animate={{ rotate: [p.rotate, p.rotate + 360] }}
            transition={{ duration: 25 + i * 5, repeat: Infinity, ease: 'linear' }}
            aria-hidden="true"
          >
            <GeometricPattern size={p.size} />
          </motion.div>
        ))}

        {/* Background: large heritage landmarks, low-opacity corner decoration */}
        <div
          className="absolute -bottom-8 -start-8 pointer-events-none select-none hidden sm:block"
          style={{ color: '#d4a657', opacity: 0.06 }}
          aria-hidden="true"
        >
          <PersepolisIcon size={220} />
        </div>
        <div
          className="absolute -top-6 -end-6 pointer-events-none select-none hidden sm:block"
          style={{ color: '#9ca3af', opacity: 0.05 }}
          aria-hidden="true"
        >
          <PasargadaeIcon size={180} />
        </div>

        {/* Hero content */}
        <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <div style={{ color: '#fbbf24', marginBottom: '1rem' }}>
              <HandsEmblem size={72} animated />
            </div>
          </motion.div>

          <motion.h1
            className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight mb-6"
            style={{
              color: '#00ffff',
              textShadow: '0 0 30px rgba(0,255,255,0.8), 0 0 60px rgba(0,255,255,0.4)',
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          >
            {heroHeadline || t('landing.headline')}
          </motion.h1>

          <motion.p
            className="text-xl sm:text-2xl text-white/70 mb-10 max-w-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            {heroTagline || t('landing.tagline')}
          </motion.p>

          <motion.div
            className="flex flex-wrap gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            {isAuthenticated && member ? (
              <Link
                href={`/${locale}/profile`}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-lg transition-all duration-200"
                style={{
                  border: '1.5px solid #8b5cf6',
                  background: 'rgba(139,92,246,0.15)',
                  color: '#c4b5fd',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(139,92,246,0.3)';
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 20px rgba(139,92,246,0.5)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(139,92,246,0.15)';
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none';
                }}
              >
                {t('landing.cta_profile')}
                <User size={18} />
              </Link>
            ) : (
              <Link
                href={`/${locale}/register`}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-lg transition-all duration-200"
                style={{
                  border: '1.5px solid #8b5cf6',
                  background: 'rgba(139,92,246,0.15)',
                  color: '#c4b5fd',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(139,92,246,0.3)';
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 20px rgba(139,92,246,0.5)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(139,92,246,0.15)';
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none';
                }}
              >
                {t('landing.cta_join')}
                <ArrowRight size={18} />
              </Link>
            )}

            <button
              onClick={handleLanguageSwitch}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-lg transition-all duration-200"
              style={{
                border: '1.5px solid #10b981',
                background: 'rgba(16,185,129,0.15)',
                color: '#6ee7b7',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.3)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(16,185,129,0.5)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.15)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
              }}
              aria-label="Switch language"
            >
              {locale === 'en' ? 'فارسی' : 'English'}
              <Languages size={18} />
            </button>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 flex flex-col items-center gap-1 text-white/30"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ArrowRight
            size={20}
            style={{ transform: 'rotate(90deg)' }}
          />
        </motion.div>
      </section>

      {/* ─── Recent Posts ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-16 px-4">
        <div
          className="absolute top-4 end-4 pointer-events-none select-none hidden md:block"
          style={{ color: '#b91c1c', opacity: 0.07 }}
          aria-hidden="true"
        >
          <HafezIcon size={90} />
        </div>

        <FadeInSection>
          <div className="max-w-6xl mx-auto">
            <h2
              className="text-3xl font-bold text-center mb-10"
              style={{ color: '#00ffff', textShadow: '0 0 10px rgba(0,255,255,0.6)' }}
            >
              {t('landing.posts_title')}
            </h2>

            {postsLoginRequired ? (
              <div className="text-center py-8 space-y-4">
                <p className="text-white/50">{t('posts.login_required_home')}</p>
                <Link
                  href={`/${locale}/login`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all"
                  style={{
                    backgroundColor: '#00ffff',
                    color: '#0a0a0f',
                    boxShadow: '0 0 24px rgba(0,255,255,0.3)',
                  }}
                >
                  {t('posts.login_cta')}
                </Link>
              </div>
            ) : postsError ? (
              <p className="text-center text-white/50 py-8">{t('posts.error_loading_home')}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {postsLoading
                  ? [0, 1, 2].map((i) => <SkeletonPostCard key={i} />)
                  : posts.length === 0
                  ? (
                    <p className="col-span-3 text-center text-white/50 py-8">
                      {t('posts.no_posts')}
                    </p>
                  )
                  : posts.map((post, idx) => (
                    <motion.div
                      key={post.id}
                      className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 flex flex-col gap-3 hover:border-white/20 transition-colors duration-200"
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <h3 className="text-white font-bold text-lg leading-snug line-clamp-2">
                        {post.title}
                      </h3>
                      <p className="text-sm" style={{ color: '#00ffff' }}>
                        {post.author?.display_name}
                      </p>
                      <p className="text-white/50 text-xs">
                        {formatDate(post.created_at)}
                      </p>
                      <div className="mt-auto pt-2">
                        <Link
                          href={`/${locale}/posts/${post.id}`}
                          className="inline-flex items-center gap-1 text-sm font-medium transition-colors duration-200"
                          style={{ color: '#00ffff' }}
                          onMouseEnter={(e) => (e.currentTarget.style.textShadow = '0 0 8px #00ffff')}
                          onMouseLeave={(e) => (e.currentTarget.style.textShadow = 'none')}
                        >
                          {t('posts.read_more')}
                          <ArrowRight size={14} />
                        </Link>
                      </div>
                    </motion.div>
                  ))
                }
              </div>
            )}
          </div>
        </FadeInSection>
      </section>

      {/* ─── Stats Bar ────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-12 px-4"
        style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="absolute -bottom-6 -end-6 pointer-events-none select-none hidden md:block"
          style={{ color: '#b45309', opacity: 0.06 }}
          aria-hidden="true"
        >
          <NaqsheRostamIcon size={130} />
        </div>

        <FadeInSection>
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <StatCard
              icon={Users}
              value={memberCount}
              label={t('landing.stats_members')}
              loading={memberCountLoading}
              locale={locale}
            />
            <StatCard
              icon={TrendingUp}
              value={balance?.total_contributions ?? 0}
              prefix="£"
              label={t('landing.stats_contributions')}
              loading={balanceLoading}
              locale={locale}
            />
            {canViewBalance && (
              <StatCard
                icon={Wallet}
                value={balance?.balance ?? 0}
                prefix="£"
                label={t('landing.stats_balance')}
                loading={balanceLoading}
                locale={locale}
              />
            )}
          </div>
        </FadeInSection>
      </section>

      {/* ─── How It Works ─────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-16 px-4"
        style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="absolute top-4 start-4 pointer-events-none select-none hidden md:block"
          style={{ color: '#10b981', opacity: 0.07 }}
          aria-hidden="true"
        >
          <SaadiIcon size={90} />
        </div>

        <FadeInSection delay={0.1}>
          <div className="max-w-5xl mx-auto">
            <h2
              className="text-3xl font-bold text-center mb-12"
              style={{ color: '#00ffff', textShadow: '0 0 10px rgba(0,255,255,0.6)' }}
            >
              {t('landing.how_title')}
            </h2>

            <div className="flex flex-wrap justify-center gap-6 md:gap-0 md:items-start">
              {/* Step 1 */}
              <div className="flex-1 min-w-[200px] max-w-xs">
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 text-center">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'rgba(0,255,255,0.1)', color: '#00ffff' }}
                  >
                    {isAuthenticated && member ? <UserCheck size={28} /> : <CheckCircle size={28} />}
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">
                    {isAuthenticated && member ? t('landing.step1_title_member') : t('landing.step1_title')}
                  </h3>
                  <p className="text-white/60 text-sm">
                    {isAuthenticated && member ? t('landing.step1_desc_member') : t('landing.step1_desc')}
                  </p>
                </div>
              </div>

              {/* Arrow (desktop only) */}
              <div className="hidden md:flex items-center px-3 mt-12" aria-hidden="true">
                <ArrowRight size={24} className="text-white/20" />
              </div>

              {/* Step 2 */}
              <div className="flex-1 min-w-[200px] max-w-xs">
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 text-center">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}
                  >
                    <TrendingUp size={28} />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">{t('landing.step2_title')}</h3>
                  <p className="text-white/60 text-sm">{t('landing.step2_desc')}</p>
                </div>
              </div>

              {/* Arrow (desktop only) */}
              <div className="hidden md:flex items-center px-3 mt-12" aria-hidden="true">
                <ArrowRight size={24} className="text-white/20" />
              </div>

              {/* Step 3 */}
              <div className="flex-1 min-w-[200px] max-w-xs">
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 text-center">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}
                  >
                    <Wallet size={28} />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">{t('landing.step3_title')}</h3>
                  <p className="text-white/60 text-sm">{t('landing.step3_desc')}</p>
                </div>
              </div>
            </div>
          </div>
        </FadeInSection>
      </section>

      {/* ─── CTA Section ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-16 px-4">
        <div
          className="absolute -bottom-10 -end-10 pointer-events-none select-none hidden sm:block"
          style={{ color: '#d4a657', opacity: 0.06 }}
          aria-hidden="true"
        >
          <PersepolisIcon size={160} />
        </div>
        <div
          className="absolute -top-8 -start-8 pointer-events-none select-none hidden sm:block"
          style={{ color: '#9ca3af', opacity: 0.05 }}
          aria-hidden="true"
        >
          <PasargadaeIcon size={140} />
        </div>

        <FadeInSection delay={0.1}>
          <div className="max-w-2xl mx-auto text-center">
            <div style={{ color: '#fbbf24', display: 'inline-block', marginBottom: '1.5rem' }}>
              <FaravaharSimple size={80} animated />
            </div>
            <h2
              className="text-4xl font-black mb-6"
              style={{
                color: '#ffffff',
                textShadow: '0 0 20px rgba(255,255,255,0.3)',
              }}
            >
              {isAuthenticated && member ? t('landing.cta_authed_title') : t('landing.cta_ready_title')}
            </h2>
            <p className="text-white/60 text-lg mb-8">
              {isAuthenticated && member ? t('landing.cta_authed_desc') : (heroTagline || t('landing.tagline'))}
            </p>
            {isAuthenticated && member ? (
              <Link
                href={`/${locale}/posts`}
                className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-bold text-xl transition-all duration-200"
                style={{
                  border: '2px solid #10b981',
                  background: 'rgba(16,185,129,0.15)',
                  color: '#10b981',
                  textShadow: '0 0 8px rgba(16,185,129,0.5)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(16,185,129,0.3)';
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 30px rgba(16,185,129,0.5)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(16,185,129,0.15)';
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none';
                }}
              >
                {t('landing.cta_view_posts')}
                <ArrowRight size={22} />
              </Link>
            ) : (
              <Link
                href={`/${locale}/register`}
                className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-bold text-xl transition-all duration-200"
                style={{
                  border: '2px solid #10b981',
                  background: 'rgba(16,185,129,0.15)',
                  color: '#10b981',
                  textShadow: '0 0 8px rgba(16,185,129,0.5)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(16,185,129,0.3)';
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 30px rgba(16,185,129,0.5)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(16,185,129,0.15)';
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none';
                }}
              >
                {t('landing.cta_join')}
                <ArrowRight size={22} />
              </Link>
            )}
          </div>
        </FadeInSection>
      </section>

    </div>
  );
}
