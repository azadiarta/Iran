'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { LionAndSun } from '@/components/animations/IranianSymbols';
import useAuthStore from '@/store/authStore';

type Group = 'guest' | 'member' | 'admin';

interface HelpSection {
  key: string;
  group: Group;
  permission?: string | string[];
  superuserOnly?: boolean;
}

const SECTIONS: HelpSection[] = [
  // ─── Always visible ──────────────────────────────────────────────
  { key: 'home', group: 'guest' },
  { key: 'posts', group: 'guest' },
  { key: 'expenses', group: 'guest' },
  { key: 'contribute', group: 'guest' },
  { key: 'contributions_public', group: 'guest' },
  { key: 'comment', group: 'guest' },
  { key: 'contact', group: 'guest' },

  // ─── Member-only ─────────────────────────────────────────────────
  { key: 'auth', group: 'member' },
  { key: 'profile', group: 'member' },
  { key: 'my_contributions', group: 'member' },
  { key: 'my_comments', group: 'member' },
  { key: 'my_messages', group: 'member' },
  { key: 'logout', group: 'member' },

  // ─── Admin panel — gated by permission ───────────────────────────
  { key: 'dashboard', group: 'admin', permission: 'can_view_dashboard' },
  { key: 'members', group: 'admin', permission: ['can_manage_permissions', 'can_view_member_details'] },
  { key: 'groups', group: 'admin', permission: 'can_manage_permissions' },
  { key: 'balance', group: 'admin', permission: 'can_view_balance' },
  { key: 'manage_posts', group: 'admin', permission: 'can_post' },
  { key: 'manage_comments', group: 'admin', permission: 'can_approve_comments' },
  { key: 'payments', group: 'admin', permission: 'can_manage_permissions' },
  { key: 'settings', group: 'admin', permission: 'can_manage_permissions' },
  { key: 'activity_log', group: 'admin', permission: 'can_manage_permissions' },
  { key: 'contact_messages', group: 'admin', permission: 'can_manage_contact_messages' },
  { key: 'system_log', group: 'admin', superuserOnly: true },
];

export default function HelpPage() {
  const t = useTranslations('help');
  const params = useParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const { member, hasPermission } = useAuthStore();
  // Auth state lives in localStorage; gate on mount so SSR and the first
  // client render agree (avoids React hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const isSuperuser = mounted && !!member?.is_superuser;
  const isAuthenticated = mounted && !!member;

  function isVisible(section: HelpSection): boolean {
    if (section.group === 'guest') return true;
    if (section.group === 'member') {
      // The auth (register/login) section only matters to visitors who aren't signed in yet
      if (section.key === 'auth') return !isAuthenticated;
      return isAuthenticated;
    }
    // Admin sections
    if (isSuperuser) return true;
    if (section.superuserOnly) return false;
    if (section.permission) {
      if (!mounted) return false;
      return Array.isArray(section.permission)
        ? section.permission.some(hasPermission)
        : hasPermission(section.permission);
    }
    return false;
  }

  const groups: { key: Group; heading: string; note: string }[] = [
    { key: 'guest', heading: t('guest_heading'), note: t('guest_note') },
    { key: 'member', heading: t('member_heading'), note: t('member_note') },
    { key: 'admin', heading: t('admin_heading'), note: t('admin_note') },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white px-4 py-10" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mx-auto w-full max-w-3xl flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 16px rgba(251,191,36,0.5))' }}>
            <LionAndSun size={48} />
          </div>
          <h1
            className="text-2xl sm:text-3xl font-bold"
            style={{ color: '#00ffff', textShadow: '0 0 20px rgba(0,255,255,0.4)' }}
          >
            {t('title')}
          </h1>
          <p className="text-sm text-white/50 max-w-xl">{t('subtitle')}</p>
        </div>

        {/* Section groups */}
        {groups.map((g) => {
          const items = SECTIONS.filter((s) => s.group === g.key && isVisible(s));
          if (items.length === 0) return null;

          return (
            <section key={g.key} className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white/90">{g.heading}</h2>
                <p className="text-xs text-white/40 mt-1">{g.note}</p>
              </div>

              <div className="flex flex-col gap-3">
                {items.map((s) => (
                  <div
                    key={s.key}
                    className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5"
                  >
                    <h3 className="text-sm font-semibold" style={{ color: '#00ffff' }}>
                      {t(`sections.${s.key}.title`)}
                    </h3>
                    <p className="text-sm text-white/60 mt-1.5 leading-relaxed">
                      {t(`sections.${s.key}.desc`)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
