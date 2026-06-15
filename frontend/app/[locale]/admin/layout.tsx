'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminLayout from '@/components/layout/AdminLayout';
import { LionAndSun } from '@/components/animations/IranianSymbols';
import useAuthStore from '@/store/authStore';
import { ADMIN_PERMISSIONS } from '@/lib/adminNav';
import '@/styles/admin.css';

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const { member, isAuthenticated, hasHydrated } = useAuthStore();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Wait until the persisted auth state is restored from localStorage,
    // otherwise a hard refresh would always start from the logged-out
    // default state and bounce authenticated users to /login.
    if (!hasHydrated) return;
    if (!isAuthenticated || !member) {
      router.replace(`/${locale}/login`);
      return;
    }
    const allowed = member.is_superuser || ADMIN_PERMISSIONS.some((p) => member.group_permissions?.includes(p));
    if (!allowed) {
      router.replace(`/${locale}/forbidden`);
      return;
    }
    setChecked(true);
  }, [hasHydrated, isAuthenticated, member, locale, router]);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--admin-bg, #05050a)' }}>
        <LionAndSun size={56} animated />
      </div>
    );
  }

  return <AdminLayout locale={locale}>{children}</AdminLayout>;
}
