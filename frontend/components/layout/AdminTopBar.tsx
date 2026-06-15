'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Bell, User, Home, LogOut, ChevronDown } from 'lucide-react';
import { LionAndSun } from '@/components/animations/IranianSymbols';
import BalanceIndicator from '@/components/common/BalanceIndicator';
import useAuthStore from '@/store/authStore';
import useLangStore from '@/store/langStore';
import { authAPI } from '@/lib/api';

interface AdminTopBarProps {
  locale: 'en' | 'fa';
  onToggleSidebar: () => void;
  pendingCommentCount?: number;
}

export default function AdminTopBar({ locale, onToggleSidebar, pendingCommentCount = 0 }: AdminTopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { member, logout } = useAuthStore();
  const { setLocale } = useLangStore();
  const isRTL = locale === 'fa';

  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    try {
      await authAPI.logout();
    } catch {
      // ignore — proceed with client-side logout regardless
    }
    logout();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
    setDropOpen(false);
    router.push(`/${locale}/login`);
  }

  function handleLanguageSwitch() {
    const newLocale = locale === 'en' ? 'fa' : 'en';
    setLocale(newLocale);
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  return (
    <header
      className="fixed top-0 z-30 flex items-center justify-between gap-3 px-4"
      style={{
        height: '56px',
        insetInlineStart: 0,
        insetInlineEnd: 0,
        backgroundColor: 'rgba(13,13,20,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--admin-border)',
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
        <Link href={`/${locale}/admin`} className="flex items-center gap-2">
          <span style={{ color: '#fbbf24' }}>
            <LionAndSun size={26} />
          </span>
          <span className="font-semibold text-white/90 text-sm hidden sm:block">
            {isRTL ? 'پنل مدیریت' : 'Admin Panel'}
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        {/* Fund balance indicator */}
        <div className="hidden sm:block">
          <BalanceIndicator />
        </div>

        {/* Language switcher */}
        <button
          onClick={handleLanguageSwitch}
          className="flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200"
          style={{
            border: '1px solid rgba(0,255,255,0.3)',
            color: 'rgba(255,255,255,0.7)',
            backgroundColor: 'transparent',
          }}
          aria-label="Switch language"
        >
          {locale === 'en' ? 'FA' : 'EN'}
        </button>

        {/* Notification bell */}
        <Link
          href={`/${locale}/admin/comments`}
          className="relative p-2 rounded-lg text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
          aria-label="Pending comments"
        >
          <Bell size={18} />
          {pendingCommentCount > 0 && (
            <span
              className="absolute flex items-center justify-center text-[10px] font-bold rounded-full"
              style={{
                top: 2,
                insetInlineEnd: 2,
                minWidth: 16,
                height: 16,
                padding: '0 3px',
                backgroundColor: '#fbbf24',
                color: '#0a0a0f',
              }}
            >
              {pendingCommentCount > 99 ? '99+' : pendingCommentCount}
            </span>
          )}
        </Link>

        {/* Profile dropdown */}
        {member && (
          <div className="relative" ref={dropRef}>
            <button
              onClick={() => setDropOpen((v) => !v)}
              className="flex items-center gap-1.5"
              aria-haspopup="true"
              aria-expanded={dropOpen}
            >
              <span
                className="flex items-center justify-center rounded-full text-xs font-bold"
                style={{
                  width: 32,
                  height: 32,
                  border: '2px solid #00ffff',
                  boxShadow: '0 0 8px rgba(0,255,255,0.4)',
                  backgroundColor: 'rgba(0,255,255,0.1)',
                  color: '#00ffff',
                }}
              >
                {getInitials(member.full_name)}
              </span>
              <ChevronDown
                size={14}
                style={{
                  color: 'rgba(255,255,255,0.5)',
                  transform: dropOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </button>

            <AnimatePresence>
              {dropOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    [isRTL ? 'left' : 'right']: 0,
                    marginTop: '0.5rem',
                    minWidth: '190px',
                    backgroundColor: 'rgba(17,17,24,0.95)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '0.5rem',
                    overflow: 'hidden',
                    zIndex: 200,
                  }}
                >
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-sm font-medium text-white truncate">{member.display_name || member.full_name}</p>
                  </div>
                  <Link
                    href={`/${locale}/profile`}
                    onClick={() => setDropOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors duration-150"
                    style={{ color: 'rgba(255,255,255,0.7)' }}
                  >
                    <User size={14} />
                    <span>{isRTL ? 'مشاهده پروفایل' : 'View Profile'}</span>
                  </Link>
                  <Link
                    href={`/${locale}`}
                    onClick={() => setDropOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors duration-150"
                    style={{ color: 'rgba(255,255,255,0.7)' }}
                  >
                    <Home size={14} />
                    <span>{isRTL ? 'بازگشت به سایت' : 'Back to Site'}</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors duration-150"
                    style={{ color: 'rgba(255,255,255,0.7)' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#ef4444')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)')}
                  >
                    <LogOut size={14} />
                    <span>{isRTL ? 'خروج' : 'Logout'}</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
  );
}
