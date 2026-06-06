'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import AdminTopBar from './AdminTopBar';
import AdminSidebar from './AdminSidebar';
import AdminToastContainer from '@/components/admin/AdminToastContainer';
import { dashboardAPI, DashboardData } from '@/lib/api';

interface AdminLayoutProps {
  locale: 'en' | 'fa';
  children: React.ReactNode;
}

export default function AdminLayout({ locale, children }: AdminLayoutProps) {
  const pathname = usePathname();
  const isRTL = locale === 'fa';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCommentCount, setPendingCommentCount] = useState(0);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    dashboardAPI
      .getStats()
      .then((res) => {
        const data = res.data as unknown as DashboardData;
        if (!cancelled && data.pending_comments) {
          setPendingCommentCount(data.pending_comments.length);
        }
      })
      .catch(() => {
        // dashboard stats are optional for the badge — fail silently
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleSidebar() {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileOpen((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  }

  const desktopPadStart = collapsed
    ? 'md:ps-[calc(var(--admin-sidebar-collapsed)_+_1.5rem)]'
    : 'md:ps-[calc(var(--admin-sidebar-width)_+_1.5rem)]';

  return (
    <div className="admin-shell" style={{ minHeight: '100vh', backgroundColor: 'var(--admin-bg)' }} dir={isRTL ? 'rtl' : 'ltr'}>
      <AdminTopBar locale={locale} onToggleSidebar={toggleSidebar} pendingCommentCount={pendingCommentCount} />
      <AdminSidebar
        locale={locale}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        pendingCommentCount={pendingCommentCount}
      />
      <main className={`transition-[padding] duration-200 ps-4 pe-4 md:pe-6 ${desktopPadStart}`} style={{ paddingTop: 'calc(56px + 1.5rem)', paddingBottom: '2rem' }}>
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
      <AdminToastContainer />
    </div>
  );
}
