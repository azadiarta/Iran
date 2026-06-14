'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import AdminStatCard from '@/components/admin/AdminStatCard';
import AdminBadge from '@/components/admin/AdminBadge';
import { LionAndSun } from '@/components/animations/IranianSymbols';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { dashboardAPI, DashboardData } from '@/lib/api';

export default function AdminDashboardPage() {
  const params = useParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const { hasPermission, member } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const canViewDashboard = !!member?.is_superuser || hasPermission('can_view_dashboard');

  useEffect(() => {
    if (!canViewDashboard) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    dashboardAPI
      .getStats()
      .then((res) => {
        if (cancelled) return;
        setData(res.data as unknown as DashboardData);
      })
      .catch(() => {
        if (!cancelled) showToast('error', isRTL ? 'بارگذاری اطلاعات داشبورد ناموفق بود' : 'Failed to load dashboard data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewDashboard]);

  function fmt(n: number) {
    return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(n);
  }

  if (!canViewDashboard) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'شما دسترسی مشاهده داشبورد را ندارید.' : 'You do not have permission to view the dashboard.'}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LionAndSun size={48} animated />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'اطلاعاتی برای نمایش وجود ندارد.' : 'No data available.'}
      </div>
    );
  }

  const chartData = [
    {
      name: isRTL ? 'این ماه' : 'This Month',
      [isRTL ? 'مشارکت‌ها' : 'Contributions']: data.fund.contributions_this_month,
      [isRTL ? 'هزینه‌ها' : 'Expenses']: data.fund.expenses_this_month,
    },
  ];

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-white">{isRTL ? 'داشبورد مدیریت' : 'Admin Dashboard'}</h1>
        <p className="text-sm text-white/40 mt-1">
          {isRTL ? `خوش آمدید، ${member?.display_name || member?.full_name}` : `Welcome back, ${member?.display_name || member?.full_name}`}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title={isRTL ? 'موجودی صندوق' : 'Fund Balance'}
          value={data.fund.balance}
          icon={Wallet}
          color="#00ffff"
          suffix={` ${data.fund.currency}`}
        />
        <AdminStatCard
          title={isRTL ? 'مجموع مشارکت‌ها' : 'Total Contributions'}
          value={data.fund.total_contributions}
          icon={TrendingUp}
          color="#10b981"
          suffix={` ${data.fund.currency}`}
        />
        <AdminStatCard
          title={isRTL ? 'مجموع هزینه‌ها' : 'Total Expenses'}
          value={data.fund.total_expenses}
          icon={TrendingDown}
          color="#ef4444"
          suffix={` ${data.fund.currency}`}
        />
        <AdminStatCard
          title={isRTL ? 'اعضا' : 'Members'}
          value={data.members.total}
          icon={Users}
          color="#8b5cf6"
          trend={data.members.active >= data.members.inactive ? 'up' : 'down'}
        />
      </div>

      {/* Chart */}
      <div className="admin-glass-card p-5">
        <h2 className="text-sm font-semibold text-white/80 mb-4">
          {isRTL ? 'مشارکت‌ها در برابر هزینه‌ها (این ماه)' : 'Contributions vs Expenses (this month)'}
        </h2>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={12} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0d0d14', border: '1px solid rgba(0,255,255,0.2)', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Bar dataKey={isRTL ? 'مشارکت‌ها' : 'Contributions'} fill="#10b981" radius={[6, 6, 0, 0]} />
              <Bar dataKey={isRTL ? 'هزینه‌ها' : 'Expenses'} fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent activity grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentCard
          title={isRTL ? 'مشارکت‌های اخیر' : 'Recent Contributions'}
          href={`/${locale}/admin/contributions`}
          isRTL={isRTL}
          emptyLabel={isRTL ? 'مشارکتی ثبت نشده' : 'No contributions yet'}
        >
          {data.recent_contributions.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
              <div className="min-w-0">
                <p className="text-sm text-white/80 truncate">{c.contributor?.display_name || c.contributor?.full_name || c.guest_name || (isRTL ? 'مهمان' : 'Guest')}</p>
                <p className="text-xs text-white/40">{fmt(c.amount)} {c.currency}</p>
              </div>
              <AdminBadge status={c.status} />
            </div>
          ))}
        </RecentCard>

        <RecentCard
          title={isRTL ? 'هزینه‌های اخیر' : 'Recent Expenses'}
          href={`/${locale}/admin/expenses`}
          isRTL={isRTL}
          emptyLabel={isRTL ? 'هزینه‌ای ثبت نشده' : 'No expenses yet'}
        >
          {data.recent_expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
              <div className="min-w-0">
                <p className="text-sm text-white/80 truncate">{e.short_reason}</p>
                <p className="text-xs text-white/40">{e.withdrawn_by?.display_name || e.withdrawn_by?.full_name || '—'}</p>
              </div>
              <p className="text-sm font-medium" style={{ color: '#ef4444' }}>-{fmt(e.amount)}</p>
            </div>
          ))}
        </RecentCard>

        <RecentCard
          title={isRTL ? 'پست‌های اخیر' : 'Recent Posts'}
          href={`/${locale}/admin/posts`}
          isRTL={isRTL}
          emptyLabel={isRTL ? 'پستی منتشر نشده' : 'No posts yet'}
        >
          {data.recent_posts.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
              <p className="text-sm text-white/80 truncate">{p.title}</p>
              <p className="text-xs text-white/40 flex-shrink-0">{p.author?.display_name || p.author?.full_name || '—'}</p>
            </div>
          ))}
        </RecentCard>

        {data.pending_comments && (
          <RecentCard
            title={isRTL ? 'نظرات در انتظار تأیید' : 'Pending Comments'}
            href={`/${locale}/admin/comments`}
            isRTL={isRTL}
            emptyLabel={isRTL ? 'نظر در انتظاری وجود ندارد' : 'No pending comments'}
            icon={<MessageSquare className="w-4 h-4" style={{ color: '#fbbf24' }} />}
          >
            {data.pending_comments.map((c) => (
              <div key={c.id} className="py-2.5 border-b border-white/[0.05] last:border-0">
                <p className="text-sm text-white/80 truncate">{c.author_label || c.guest_name || (isRTL ? 'مهمان' : 'Guest')}</p>
                <p className="text-xs text-white/40 truncate">{c.text}</p>
              </div>
            ))}
          </RecentCard>
        )}
      </div>
    </div>
  );
}

function RecentCard({
  title,
  href,
  isRTL,
  emptyLabel,
  icon,
  children,
}: {
  title: string;
  href: string;
  isRTL: boolean;
  emptyLabel: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="admin-glass-card p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <Link href={href} className="flex items-center gap-1 text-xs transition-colors" style={{ color: '#00ffff' }}>
          {isRTL ? 'مشاهده همه' : 'View all'}
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {hasChildren ? <div>{children}</div> : <p className="text-sm text-white/30 py-6 text-center">{emptyLabel}</p>}
    </div>
  );
}
