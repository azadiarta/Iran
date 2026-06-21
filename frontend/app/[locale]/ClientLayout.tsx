'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import SplashScreen from '@/components/animations/SplashScreen';
import DeactivatedGuard from '@/components/layout/DeactivatedGuard';
import AuthSync from '@/components/layout/AuthSync';
import LockdownSync from '@/components/layout/LockdownSync';
import LockdownPage from '@/components/lockdown/LockdownPage';
import useLangStore from '@/store/langStore';
import useAuthStore from '@/store/authStore';
import useLockdownStore from '@/store/lockdownStore';
import { hasAdminAccess } from '@/lib/adminNav';

interface ClientLayoutProps {
  children: React.ReactNode;
  locale: 'en' | 'fa';
}

export default function ClientLayout({ children, locale }: ClientLayoutProps) {
  const [splashDone, setSplashDone] = useState(false);
  const { setLocale } = useLangStore();
  const pathname = usePathname();
  const { member, hasHydrated } = useAuthStore();
  const { kind, message } = useLockdownStore();

  useEffect(() => {
    setLocale(locale);
  }, [locale, setLocale]);

  // Admin routes render their own AdminTopBar/AdminSidebar shell, so the
  // public Navbar/Footer must be skipped to avoid a double navigation chrome.
  const isAdminRoute = pathname?.startsWith(`/${locale}/admin`);

  // The login page stays reachable through any lockdown — otherwise the
  // superuser (or an exempt admin) would have no way to sign in and lift it.
  const isLoginRoute = pathname === `/${locale}/login`;

  // Deny-by-default: until auth state is known, treat the visitor as not
  // exempt. Mirrors the backend's own allowlist logic in core/lockdown.py.
  let isBlocked = false;
  if (!isLoginRoute && kind === 'superuser') {
    isBlocked = !(hasHydrated && member?.is_superuser);
  } else if (!isLoginRoute && kind === 'permission') {
    isBlocked = !(
      hasHydrated &&
      hasAdminAccess({ isSuperuser: !!member?.is_superuser, groupPermissions: member?.group_permissions })
    );
  }

  if (isBlocked) {
    return (
      <>
        <AuthSync />
        <LockdownSync />
        <LockdownPage locale={locale} message={message} />
      </>
    );
  }

  if (isAdminRoute) {
    return (
      <>
        <AuthSync />
        <LockdownSync />
        <DeactivatedGuard locale={locale} />
        {!splashDone && (
          <SplashScreen locale={locale} onComplete={() => setSplashDone(true)} />
        )}
        <main className="flex-1">{children}</main>
      </>
    );
  }

  return (
    <>
      <AuthSync />
      <LockdownSync />
      <DeactivatedGuard locale={locale} />
      {!splashDone && (
        <SplashScreen locale={locale} onComplete={() => setSplashDone(true)} />
      )}
      <Navbar locale={locale} />
      <main className="flex-1 pt-16">
        {children}
      </main>
      <Footer locale={locale} />
    </>
  );
}
