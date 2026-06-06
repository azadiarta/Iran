'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  HandCoins,
  Receipt,
  Newspaper,
  MessageSquare,
  Wallet,
  Settings,
  ScrollText,
  Terminal,
  X,
} from 'lucide-react';
import { LionAndSun } from '@/components/animations/IranianSymbols';
import useAuthStore from '@/store/authStore';

interface AdminSidebarProps {
  locale: 'en' | 'fa';
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  pendingCommentCount?: number;
}

interface NavItem {
  key: string;
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
  badge?: number;
  superuserOnly?: boolean;
  divider?: boolean;
}

export default function AdminSidebar({
  locale,
  collapsed,
  mobileOpen,
  onMobileClose,
  pendingCommentCount = 0,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const { member, hasPermission } = useAuthStore();
  const isRTL = locale === 'fa';
  const isSuperuser = !!member?.is_superuser;

  const items: NavItem[] = [
    { key: 'dashboard', href: '', label: isRTL ? 'داشبورد' : 'Dashboard', icon: LayoutDashboard, permission: 'can_view_dashboard' },
    { key: 'members', href: 'members', label: isRTL ? 'اعضا' : 'Members', icon: Users, permission: 'can_manage_permissions' },
    { key: 'groups', href: 'groups', label: isRTL ? 'گروه‌ها' : 'Groups', icon: ShieldCheck, permission: 'can_manage_permissions' },
    { key: 'contributions', href: 'contributions', label: isRTL ? 'مشارکت‌ها' : 'Contributions', icon: HandCoins, permission: 'can_view_balance' },
    { key: 'expenses', href: 'expenses', label: isRTL ? 'هزینه‌ها' : 'Expenses', icon: Receipt, permission: 'can_view_balance' },
    { key: 'posts', href: 'posts', label: isRTL ? 'پست‌ها' : 'Posts', icon: Newspaper, permission: 'can_post' },
    { key: 'comments', href: 'comments', label: isRTL ? 'نظرات' : 'Comments', icon: MessageSquare, permission: 'can_approve_comments', badge: pendingCommentCount },
    { key: 'payments', href: 'payments', label: isRTL ? 'تنظیمات پرداخت' : 'Payments', icon: Wallet, permission: 'can_manage_permissions' },
    { key: 'settings', href: 'settings', label: isRTL ? 'تنظیمات' : 'Settings', icon: Settings, permission: 'can_manage_permissions' },
    { key: 'activity-log', href: 'logs/activity', label: isRTL ? 'گزارش فعالیت' : 'Activity Log', icon: ScrollText, divider: true, permission: 'can_manage_permissions' },
    { key: 'system-log', href: 'logs/system', label: isRTL ? 'گزارش سیستم' : 'System Log', icon: Terminal, superuserOnly: true },
  ];

  function isVisible(item: NavItem) {
    if (isSuperuser) return true;
    if (item.superuserOnly) return false;
    if (item.permission) return hasPermission(item.permission);
    return true;
  }

  function isActive(href: string) {
    const base = `/${locale}/admin`;
    const target = href ? `${base}/${href}` : base;
    if (href === '') return pathname === base || pathname === `${base}/`;
    return pathname === target || pathname.startsWith(`${target}/`);
  }

  const width = collapsed ? 'var(--admin-sidebar-collapsed)' : 'var(--admin-sidebar-width)';

  const content = (
    <nav className="flex flex-col gap-1 px-2 py-4 overflow-y-auto h-full" dir={isRTL ? 'rtl' : 'ltr'}>
      {items.filter(isVisible).map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <div key={item.key}>
            {item.divider && (
              <div className="my-2 mx-2 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
            )}
            <Link
              href={`/${locale}/admin${item.href ? `/${item.href}` : ''}`}
              onClick={onMobileClose}
              className={`admin-nav-item flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all relative ${active ? 'active' : ''}`}
              style={{
                color: active ? '#00ffff' : 'rgba(255,255,255,0.6)',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!!item.badge && item.badge > 0 && (
                <span
                  className="flex-shrink-0 flex items-center justify-center text-[10px] font-bold rounded-full"
                  style={{
                    minWidth: 18,
                    height: 18,
                    padding: '0 4px',
                    backgroundColor: '#fbbf24',
                    color: '#0a0a0f',
                    marginInlineStart: collapsed ? 0 : 'auto',
                    position: collapsed ? 'absolute' : 'static',
                    top: collapsed ? 4 : undefined,
                    insetInlineEnd: collapsed ? 4 : undefined,
                  }}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="hidden md:flex flex-col fixed top-0 bottom-0 z-40 admin-surface"
        style={{
          [isRTL ? 'right' : 'left']: 0,
          borderInlineEnd: '1px solid var(--admin-border)',
          paddingTop: '56px',
        }}
      >
        <div className="flex items-center gap-2 px-4 py-4" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <LionAndSun size={28} className="flex-shrink-0" />
          {!collapsed && (
            <span className="font-semibold text-white/80 text-sm truncate">
              {isRTL ? 'پنل مدیریت' : 'Admin Panel'}
            </span>
          )}
        </div>
        {content}
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="admin-sidebar-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="md:hidden fixed inset-0 z-40"
              style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            />
            <motion.aside
              key="admin-sidebar-drawer"
              initial={{ x: isRTL ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '100%' : '-100%' }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="md:hidden fixed top-0 bottom-0 z-50 flex flex-col admin-surface"
              style={{
                [isRTL ? 'right' : 'left']: 0,
                width: 'var(--admin-sidebar-width)',
                borderInlineEnd: '1px solid var(--admin-border)',
              }}
            >
              <div className="flex items-center justify-between gap-2 px-4 py-4" style={{ borderBottom: '1px solid var(--admin-border)' }}>
                <div className="flex items-center gap-2">
                  <LionAndSun size={28} />
                  <span className="font-semibold text-white/80 text-sm">{isRTL ? 'پنل مدیریت' : 'Admin Panel'}</span>
                </div>
                <button onClick={onMobileClose} className="p-1.5 rounded-lg text-white/50 hover:text-white/80" aria-label="Close menu">
                  <X size={18} />
                </button>
              </div>
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
