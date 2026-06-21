'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Menu, X, User, LogOut, ChevronDown, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { HandsEmblem } from '@/components/animations/IranianSymbols';
import BalanceIndicator from '@/components/common/BalanceIndicator';
import useAuthStore from '@/store/authStore';
import useLangStore from '@/store/langStore';
import { authAPI } from '@/lib/api';
import { hasAdminAccess } from '@/lib/adminNav';

interface NavbarProps {
  locale: 'en' | 'fa';
}

interface NavLink {
  key: string;
  href: string;
  label: string;
}

export default function Navbar({ locale }: NavbarProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();
  const { member, isAuthenticated, logout } = useAuthStore();
  const { setLocale } = useLangStore();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userDropOpen, setUserDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  // Auth state comes from localStorage, which the server can't see; only
  // render auth-dependent UI after mount so SSR and first client render match.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close user dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setUserDropOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const allNavLinks: NavLink[] = [
    { key: 'home', href: '', label: t('home') },
    { key: 'posts', href: 'posts', label: t('posts') },
    { key: 'expenses', href: 'expenses', label: t('expenses') },
    { key: 'contribute', href: 'contribute', label: t('contribute') },
    { key: 'contributions', href: 'contributions', label: t('contributions') },
    { key: 'help', href: 'help', label: t('help') },
    { key: 'contact', href: 'contact', label: t('contact') },
  ];

  // Deactivated members can only reach Home + Contact (see DeactivatedGuard).
  const isDeactivated = mounted && member?.is_active === false;
  const navLinks: NavLink[] = isDeactivated
    ? allNavLinks.filter((l) => l.key === 'home' || l.key === 'contact')
    : allNavLinks;

  const canAccessAdmin =
    mounted &&
    !!member &&
    !isDeactivated &&
    hasAdminAccess({ isSuperuser: member.is_superuser, groupPermissions: member.group_permissions });

  // Active detection: strip locale prefix
  const pathSegments = pathname.split('/').filter(Boolean);
  const activePath = pathSegments.length > 1 ? pathSegments.slice(1).join('/') : '';

  function isActive(href: string) {
    if (href === '') {
      // Home: only active at locale root
      return pathSegments.length <= 1 || (pathSegments.length === 2 && pathSegments[1] === '');
    }
    return activePath === href || activePath.startsWith(href + '/');
  }

  function getHref(href: string) {
    return href === '' ? `/${locale}` : `/${locale}/${href}`;
  }

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
    setUserDropOpen(false);
    setMobileOpen(false);
    router.push(`/${locale}/login`);
  }

  function handleLanguageSwitch() {
    const newLocale = locale === 'en' ? 'fa' : 'en';
    setLocale(newLocale);
    // Replace locale segment in current path
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  }

  // Get initials for avatar
  function getInitials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  const isRTL = locale === 'fa';

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          backgroundColor: 'rgba(10,10,15,0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <nav
          className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Logo */}
          <Link href={`/${locale}`} className="flex items-center gap-2 shrink-0">
            <span style={{ color: '#fbbf24' }}>
              <HandsEmblem size={32} />
            </span>
            <span
              className="font-semibold text-white text-lg hidden sm:block"
              style={{
                fontFamily: isRTL ? 'Vazirmatn, sans-serif' : 'Inter, sans-serif',
              }}
            >
              {process.env.NEXT_PUBLIC_SITE_NAME || 'Group Fund'}
            </span>
          </Link>

          {/* Desktop nav links */}
          <ul className="hidden md:flex items-center gap-1" dir={isRTL ? 'rtl' : 'ltr'}>
            {navLinks.map((link) => (
              <li key={link.key}>
                <Link
                  href={getHref(link.href)}
                  className="relative px-3 py-2 text-sm transition-colors duration-200"
                  style={{
                    color: isActive(link.href) ? '#00ffff' : 'rgba(255,255,255,0.7)',
                    fontFamily: isRTL ? 'Vazirmatn, sans-serif' : 'Inter, sans-serif',
                  }}
                >
                  {link.label}
                  {isActive(link.href) && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: isRTL ? 'auto' : 0,
                        right: isRTL ? 0 : 'auto',
                        width: '100%',
                        height: '2px',
                        backgroundColor: '#00ffff',
                        boxShadow: '0 0 8px #00ffff',
                        borderRadius: '1px',
                      }}
                    />
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {/* Right section */}
          <div className="flex items-center gap-2">
            {/* Fund balance indicator */}
            {!isDeactivated && (
              <div className="hidden md:block">
                <BalanceIndicator />
              </div>
            )}

            {/* Language switcher */}
            <button
              onClick={handleLanguageSwitch}
              className="hidden md:flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200"
              style={{
                border: '1px solid rgba(0,255,255,0.3)',
                color: 'rgba(255,255,255,0.7)',
                backgroundColor: 'transparent',
                fontFamily: 'Inter, sans-serif',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#00ffff';
                (e.currentTarget as HTMLButtonElement).style.color = '#00ffff';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,255,255,0.3)';
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)';
              }}
              aria-label="Switch language"
            >
              {locale === 'en' ? 'FA' : 'EN'}
            </button>

            {/* Auth section — desktop */}
            {mounted && isAuthenticated && member ? (
              <div className="hidden md:block relative" ref={dropRef}>
                <button
                  onClick={() => setUserDropOpen((v) => !v)}
                  className="flex items-center gap-1.5"
                  aria-haspopup="true"
                  aria-expanded={userDropOpen}
                >
                  <span
                    className="flex items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      width: 36,
                      height: 36,
                      border: '2px solid #00ffff',
                      boxShadow: '0 0 8px rgba(0,255,255,0.4)',
                      backgroundColor: 'rgba(0,255,255,0.1)',
                      color: '#00ffff',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {getInitials(member.full_name)}
                  </span>
                  <ChevronDown
                    size={14}
                    style={{
                      color: 'rgba(255,255,255,0.5)',
                      transform: userDropOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  />
                </button>

                <AnimatePresence>
                  {userDropOpen && (
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
                        minWidth: '180px',
                        backgroundColor: 'rgba(17,17,24,0.95)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '0.5rem',
                        overflow: 'hidden',
                        zIndex: 200,
                      }}
                    >
                      <div
                        style={{
                          padding: '0.75rem 1rem',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <p
                          className="text-sm font-medium text-white truncate"
                          style={{ fontFamily: isRTL ? 'Vazirmatn, sans-serif' : 'Inter, sans-serif' }}
                        >
                          {member.display_name || member.full_name}
                        </p>
                      </div>
                      {canAccessAdmin && (
                        <Link
                          href={`/${locale}/admin`}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors duration-150"
                          style={{ color: 'rgba(255,255,255,0.7)' }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = '#00ffff')}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.7)')}
                          onClick={() => setUserDropOpen(false)}
                          dir={isRTL ? 'rtl' : 'ltr'}
                        >
                          <ShieldCheck size={14} />
                          <span style={{ fontFamily: isRTL ? 'Vazirmatn, sans-serif' : 'Inter, sans-serif' }}>
                            {t('admin_panel')}
                          </span>
                        </Link>
                      )}
                      {!isDeactivated && (
                        <Link
                          href={`/${locale}/profile`}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors duration-150"
                          style={{ color: 'rgba(255,255,255,0.7)' }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = '#00ffff')}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.7)')}
                          onClick={() => setUserDropOpen(false)}
                          dir={isRTL ? 'rtl' : 'ltr'}
                        >
                          <User size={14} />
                          <span style={{ fontFamily: isRTL ? 'Vazirmatn, sans-serif' : 'Inter, sans-serif' }}>
                            {t('profile')}
                          </span>
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors duration-150"
                        style={{ color: 'rgba(255,255,255,0.7)' }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#ef4444')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)')}
                        dir={isRTL ? 'rtl' : 'ltr'}
                      >
                        <LogOut size={14} />
                        <span style={{ fontFamily: isRTL ? 'Vazirmatn, sans-serif' : 'Inter, sans-serif' }}>
                          {t('logout')}
                        </span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                href={`/${locale}/login`}
                className="hidden md:inline-flex items-center justify-center rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-200"
                style={{
                  border: '1px solid #00ffff',
                  color: '#00ffff',
                  backgroundColor: 'rgba(0,255,255,0.05)',
                  boxShadow: '0 0 8px rgba(0,255,255,0.15)',
                  fontFamily: isRTL ? 'Vazirmatn, sans-serif' : 'Inter, sans-serif',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(0,255,255,0.1)';
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 16px rgba(0,255,255,0.3)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(0,255,255,0.05)';
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 8px rgba(0,255,255,0.15)';
                }}
              >
                {t('login')}
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-md"
              style={{ color: 'rgba(255,255,255,0.7)' }}
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Overlay */}
            <motion.div
              key="mobile-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 90,
                backgroundColor: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(2px)',
              }}
            />

            {/* Drawer */}
            <motion.div
              key="mobile-drawer"
              initial={{ x: isRTL ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '-100%' : '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{
                position: 'fixed',
                top: 0,
                [isRTL ? 'left' : 'right']: 0,
                bottom: 0,
                zIndex: 95,
                width: '280px',
                backgroundColor: 'rgba(10,10,15,0.98)',
                backdropFilter: 'blur(20px)',
                borderLeft: isRTL ? 'none' : '1px solid rgba(255,255,255,0.08)',
                borderRight: isRTL ? '1px solid rgba(255,255,255,0.08)' : 'none',
                display: 'flex',
                flexDirection: 'column',
                padding: '1rem',
                overflowY: 'auto',
              }}
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between mb-6 pt-2">
                <Link
                  href={`/${locale}`}
                  className="flex items-center gap-2"
                  onClick={() => setMobileOpen(false)}
                >
                  <span style={{ color: '#fbbf24' }}>
                    <HandsEmblem size={28} />
                  </span>
                  <span
                    className="font-semibold text-white"
                    style={{ fontFamily: isRTL ? 'Vazirmatn, sans-serif' : 'Inter, sans-serif' }}
                  >
                    {process.env.NEXT_PUBLIC_SITE_NAME || 'Group Fund'}
                  </span>
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Mobile nav links */}
              <nav className="flex flex-col gap-1 flex-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.key}
                    href={getHref(link.href)}
                    className="flex items-center px-3 py-3 rounded-md text-sm font-medium transition-colors duration-150"
                    style={{
                      color: isActive(link.href) ? '#00ffff' : 'rgba(255,255,255,0.7)',
                      backgroundColor: isActive(link.href) ? 'rgba(0,255,255,0.08)' : 'transparent',
                      borderLeft: isActive(link.href) && !isRTL ? '2px solid #00ffff' : 'none',
                      borderRight: isActive(link.href) && isRTL ? '2px solid #00ffff' : 'none',
                      paddingLeft: !isRTL ? (isActive(link.href) ? '0.875rem' : '0.75rem') : '0.75rem',
                      paddingRight: isRTL ? (isActive(link.href) ? '0.875rem' : '0.75rem') : '0.75rem',
                      fontFamily: isRTL ? 'Vazirmatn, sans-serif' : 'Inter, sans-serif',
                    }}
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              {/* Mobile auth + lang */}
              <div
                className="mt-4 pt-4 flex flex-col gap-3"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                {/* Fund balance indicator */}
                {!isDeactivated && <BalanceIndicator className="self-start" />}

                {mounted && isAuthenticated && member ? (
                  <>
                    <div className="flex items-center gap-3 px-1">
                      <span
                        className="flex items-center justify-center rounded-full text-xs font-bold shrink-0"
                        style={{
                          width: 36,
                          height: 36,
                          border: '2px solid #00ffff',
                          backgroundColor: 'rgba(0,255,255,0.1)',
                          color: '#00ffff',
                        }}
                      >
                        {getInitials(member.full_name)}
                      </span>
                      <span
                        className="text-sm text-white truncate"
                        style={{ fontFamily: isRTL ? 'Vazirmatn, sans-serif' : 'Inter, sans-serif' }}
                      >
                        {member.display_name || member.full_name}
                      </span>
                    </div>
                    {canAccessAdmin && (
                      <Link
                        href={`/${locale}/admin`}
                        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors duration-150"
                        style={{
                          color: 'rgba(255,255,255,0.7)',
                          fontFamily: isRTL ? 'Vazirmatn, sans-serif' : 'Inter, sans-serif',
                        }}
                        onClick={() => setMobileOpen(false)}
                      >
                        <ShieldCheck size={14} />
                        {t('admin_panel')}
                      </Link>
                    )}
                    {!isDeactivated && (
                      <Link
                        href={`/${locale}/profile`}
                        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors duration-150"
                        style={{
                          color: 'rgba(255,255,255,0.7)',
                          fontFamily: isRTL ? 'Vazirmatn, sans-serif' : 'Inter, sans-serif',
                        }}
                        onClick={() => setMobileOpen(false)}
                      >
                        <User size={14} />
                        {t('profile')}
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors duration-150"
                      style={{
                        color: '#ef4444',
                        fontFamily: isRTL ? 'Vazirmatn, sans-serif' : 'Inter, sans-serif',
                      }}
                    >
                      <LogOut size={14} />
                      {t('logout')}
                    </button>
                  </>
                ) : (
                  <Link
                    href={`/${locale}/login`}
                    className="flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium"
                    style={{
                      border: '1px solid #00ffff',
                      color: '#00ffff',
                      backgroundColor: 'rgba(0,255,255,0.05)',
                      fontFamily: isRTL ? 'Vazirmatn, sans-serif' : 'Inter, sans-serif',
                    }}
                    onClick={() => setMobileOpen(false)}
                  >
                    {t('login')}
                  </Link>
                )}

                {/* Language switcher */}
                <button
                  onClick={() => {
                    handleLanguageSwitch();
                    setMobileOpen(false);
                  }}
                  className="flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200"
                  style={{
                    border: '1px solid rgba(0,255,255,0.3)',
                    color: 'rgba(255,255,255,0.7)',
                    backgroundColor: 'transparent',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {locale === 'en' ? 'فارسی' : 'English'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
