'use client';
import { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import SplashScreen from '@/components/animations/SplashScreen';
import useLangStore from '@/store/langStore';

interface ClientLayoutProps {
  children: React.ReactNode;
  locale: 'en' | 'fa';
}

export default function ClientLayout({ children, locale }: ClientLayoutProps) {
  const [splashDone, setSplashDone] = useState(false);
  const { setLocale } = useLangStore();

  useEffect(() => {
    setLocale(locale);
  }, [locale, setLocale]);

  return (
    <>
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
