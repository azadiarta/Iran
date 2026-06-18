import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  HandCoins,
  Receipt,
  Newspaper,
  MessageSquare,
  Mail,
  Wallet,
  Settings,
  Database,
  ScrollText,
  Terminal,
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
  badgeKey?: 'pendingCommentCount' | 'pendingContributionCount' | 'pendingContactMessageCount';
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { key: 'dashboard', href: '', label: { en: 'Dashboard', fa: 'داشبورد' }, icon: LayoutDashboard, permission: 'can_view_dashboard' },
  { key: 'members', href: 'members', label: { en: 'Members', fa: 'اعضا' }, icon: Users, permission: 'can_manage_permissions' },
  { key: 'groups', href: 'groups', label: { en: 'Groups', fa: 'گروه‌ها' }, icon: ShieldCheck, permission: 'can_manage_permissions' },
  { key: 'contributions', href: 'contributions', label: { en: 'Contributions', fa: 'مشارکت‌ها' }, icon: HandCoins, permission: 'can_view_balance', badgeKey: 'pendingContributionCount' },
  { key: 'expenses', href: 'expenses', label: { en: 'Expenses', fa: 'هزینه‌ها' }, icon: Receipt, permission: ['can_view_balance', 'can_expense'] },
  { key: 'posts', href: 'posts', label: { en: 'Posts', fa: 'پست‌ها' }, icon: Newspaper, permission: 'can_post' },
  { key: 'comments', href: 'comments', label: { en: 'Comments', fa: 'نظرات' }, icon: MessageSquare, permission: 'can_approve_comments', badgeKey: 'pendingCommentCount' },
  { key: 'contact-messages', href: 'contact-messages', label: { en: 'Contact Messages', fa: 'پیام‌های تماس' }, icon: Mail, permission: 'can_manage_contact_messages', badgeKey: 'pendingContactMessageCount' },
  { key: 'payments', href: 'payments', label: { en: 'Payments', fa: 'تنظیمات پرداخت' }, icon: Wallet, permission: 'can_manage_permissions' },
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

// Permissions granted to the default group (see seed_initial_data.py
// DEFAULT_GROUP_PERMISSIONS): commenting, contributing, viewing the fund
// balance and viewing posts. Every plan/group is expected to include these
// by default. A member whose group has no permission *outside* this set is
// a regular member and must not see the "enter admin panel" button or be
// able to reach /admin.
export const BASELINE_PERMISSIONS: string[] = [
  'can_comment',
  'can_contribute',
  'can_view_balance',
  'can_view_posts',
];

export function hasAdminAccess(opts: {
  isSuperuser: boolean;
  groupPermissions?: string[] | null;
}): boolean {
  if (opts.isSuperuser) return true;
  return (opts.groupPermissions || []).some((p) => !BASELINE_PERMISSIONS.includes(p));
}
