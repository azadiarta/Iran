'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/authStore';

interface DeactivatedGuardProps {
  locale: 'en' | 'fa';
}

// Deactivated members can still log in (item V), but everywhere except the
// home page and the contact page redirects back home.
export default function DeactivatedGuard({ locale }: DeactivatedGuardProps) {
  const { member, hasHydrated } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!hasHydrated || !member || member.is_active !== false) return;
    const home = `/${locale}`;
    const contact = `/${locale}/contact`;
    if (pathname === home || pathname === contact) return;
    router.replace(home);
  }, [hasHydrated, member, pathname, locale, router]);

  return null;
}
