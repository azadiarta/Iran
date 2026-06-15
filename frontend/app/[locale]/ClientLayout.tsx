'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import SplashScreen from '@/components/animations/SplashScreen';
import DeactivatedGuard from '@/components/layout/DeactivatedGuard';
import useLangStore from '@/store/langStore';

interface ClientLayoutProps {
  children: React.ReactNode;
  locale: 'en' | 'fa';
}

export default function ClientLayout({ children, locale }: ClientLayoutProps) {
  const [splashDone, setSplashDone] = useState(false);
  const { setLocale } = useLangStore();
  const pathname = usePathname();

  useEffect(() => {
    setLocale(locale);
  }, [locale, setLocale]);

  // Admin routes render their own AdminTopBar/AdminSidebar shell, so the
  // public Navbar/Footer must be skipped to avoid a double navigation chrome.
  const isAdminRoute = pathname?.startsWith(`/${locale}/admin`);

  if (isAdminRoute) {
    return (
      <>
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
