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
  Database,
  ScrollText,
  Terminal,
  Server,
} from 'lucide-react';

export interface AdminNavItem {
  key: string;
  href: string;
  label: { en: string; fa: string };
  icon: React.ElementType;
  // A single permission, or a list where ANY one is sufficient.
  permission?: string | string[];
  superuserOnly?: boolean;
  divider?: boolean;
  badgeKey?: 'pendingCommentCount' | 'pendingContributionCount';
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { key: 'dashboard', href: '', label: { en: 'Dashboard', fa: 'داشبورد' }, icon: LayoutDashboard, permission: 'can_view_dashboard' },
  { key: 'members', href: 'members', label: { en: 'Members', fa: 'اعضا' }, icon: Users, permission: 'can_manage_permissions' },
  { key: 'groups', href: 'groups', label: { en: 'Groups', fa: 'گروه‌ها' }, icon: ShieldCheck, permission: 'can_manage_permissions' },
  { key: 'contributions', href: 'contributions', label: { en: 'Contributions', fa: 'مشارکت‌ها' }, icon: HandCoins, permission: 'can_view_balance', badgeKey: 'pendingContributionCount' },
  { key: 'expenses', href: 'expenses', label: { en: 'Expenses', fa: 'هزینه‌ها' }, icon: Receipt, permission: ['can_view_balance', 'can_expense'] },
  { key: 'posts', href: 'posts', label: { en: 'Posts', fa: 'پست‌ها' }, icon: Newspaper, permission: 'can_post' },
  { key: 'comments', href: 'comments', label: { en: 'Comments', fa: 'نظرات' }, icon: MessageSquare, permission: 'can_approve_comments', badgeKey: 'pendingCommentCount' },
  { key: 'payments', href: 'payments', label: { en: 'Payments', fa: 'تنظیمات پرداخت' }, icon: Wallet, permission: 'can_manage_permissions' },
  { key: 'env-vars', href: 'env-vars', label: { en: 'Environment Variables', fa: 'متغیرهای محیطی' }, icon: Server, permission: 'can_manage_env_vars' },
  { key: 'settings', href: 'settings', label: { en: 'Settings', fa: 'تنظیمات' }, icon: Settings, permission: 'can_manage_permissions' },
  { key: 'system-status', href: 'system', label: { en: 'System Status', fa: 'وضعیت سیستم' }, icon: Database, superuserOnly: true },
  { key: 'activity-log', href: 'logs/activity', label: { en: 'Activity Log', fa: 'گزارش فعالیت' }, icon: ScrollText, divider: true, permission: 'can_manage_permissions' },
  { key: 'system-log', href: 'logs/system', label: { en: 'System Log', fa: 'گزارش سیستم' }, icon: Terminal, superuserOnly: true },
];

export function isNavItemVisible(
  item: AdminNavItem,
  opts: { isSuperuser: boolean; hasPermission: (codename: string) => boolean }
): boolean {
  if (opts.isSuperuser) return true;
  if (item.superuserOnly) return false;
  if (!item.permission) return true;
  if (Array.isArray(item.permission)) return item.permission.some(opts.hasPermission);
  return opts.hasPermission(item.permission);
}

// Any member holding at least one of these permissions can enter /admin
// (superuserOnly items are excluded -- superusers bypass this check entirely).
export const ADMIN_PERMISSIONS: string[] = Array.from(
  new Set(
    ADMIN_NAV_ITEMS.flatMap((item) => {
      if (!item.permission) return [];
      return Array.isArray(item.permission) ? item.permission : [item.permission];
    })
  )
);
