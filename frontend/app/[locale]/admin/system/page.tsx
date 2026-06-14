'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Database,
  Bug,
  Server,
  HardDrive,
  Code2,
  Users,
  Newspaper,
  HandCoins,
  Receipt,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import AdminStatCard from '@/components/admin/AdminStatCard';
import AdminBadge from '@/components/admin/AdminBadge';
import { LionAndSun } from '@/components/animations/IranianSymbols';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { systemAPI, SystemStatus } from '@/lib/api';

const DB_ENGINE_LABELS: Record<string, string> = {
  postgresql: 'PostgreSQL',
  sqlite3: 'SQLite',
  mysql: 'MySQL',
};

function InfoCard({
  icon: Icon,
  label,
  value,
  accentColor = '#00ffff',
  badge,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accentColor?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="admin-glass-card p-5 flex items-start gap-4">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${accentColor}1a`, boxShadow: `0 0 20px ${accentColor}26` }}
      >
        <Icon className="w-5 h-5" style={{ color: accentColor }} />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-xs text-white/50">{label}</p>
        <p className="text-lg font-bold truncate" style={{ color: accentColor }}>{value}</p>
        {badge}
      </div>
    </div>
  );
}

export default function AdminSystemStatusPage() {
  const params = useParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const { member } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const isSuperuser = !!member?.is_superuser;

  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperuser) {
      setLoading(false);
      return;
    }
    systemAPI
      .getStatus()
      .then((res) => setStatus(res.data as unknown as SystemStatus))
      .catch(() => showToast('error', isRTL ? 'بارگذاری وضعیت سیستم ناموفق بود' : 'Failed to load system status'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperuser]);

  if (!isSuperuser) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'این بخش فقط برای مدیران ارشد در دسترس است.' : 'This section is only available to superusers.'}
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

  if (!status) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'اطلاعاتی برای نمایش وجود ندارد.' : 'No data available.'}
      </div>
    );
  }

  const dbEngineLabel = DB_ENGINE_LABELS[status.database.engine] || status.database.engine;
  const debugWarn = status.debug && status.environment === 'railway';

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-white">{isRTL ? 'وضعیت سیستم' : 'System Status'}</h1>
        <p className="text-sm text-white/40 mt-1">
          {isRTL ? 'اطلاعات زیرساخت و آمار کلی سامانه' : 'Infrastructure information and overall statistics'}
        </p>
      </div>

      {/* Infrastructure */}
      <div>
        <h2 className="text-sm font-semibold text-white/80 mb-3">
          {isRTL ? 'زیرساخت' : 'Infrastructure'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoCard
            icon={Database}
            label={isRTL ? 'پایگاه داده' : 'Database'}
            value={dbEngineLabel}
            accentColor={status.database.connected ? '#10b981' : '#ef4444'}
            badge={
              <AdminBadge
                status={status.database.connected ? 'active' : 'inactive'}
                label={status.database.connected ? (isRTL ? 'متصل' : 'Connected') : (isRTL ? 'قطع' : 'Disconnected')}
              />
            }
          />
          <InfoCard
            icon={Bug}
            label={isRTL ? 'حالت توسعه (DEBUG)' : 'Debug Mode'}
            value={status.debug ? (isRTL ? 'فعال' : 'Enabled') : (isRTL ? 'غیرفعال' : 'Disabled')}
            accentColor={status.debug ? '#ef4444' : '#10b981'}
            badge={
              debugWarn ? (
                <AdminBadge status="failed" label={isRTL ? 'هشدار: محیط عملیاتی' : 'Warning: production'} />
              ) : undefined
            }
          />
          <InfoCard
            icon={Server}
            label={isRTL ? 'محیط اجرا' : 'Environment'}
            value={status.environment === 'railway' ? 'Railway' : (isRTL ? 'محلی' : 'Local')}
          />
          <InfoCard
            icon={HardDrive}
            label={isRTL ? 'ذخیره‌سازی فایل‌ها' : 'Media Storage'}
            value={status.media_storage === 's3' ? 'Amazon S3' : (isRTL ? 'محلی' : 'Local')}
          />
          <InfoCard
            icon={Code2}
            label={isRTL ? 'نسخه Django' : 'Django Version'}
            value={status.django_version}
          />
        </div>
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-sm font-semibold text-white/80 mb-3">
          {isRTL ? 'آمار کلی' : 'Overall Statistics'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AdminStatCard
            title={isRTL ? 'کل اعضا' : 'Total Members'}
            value={status.counts.members_total}
            icon={Users}
            color="#8b5cf6"
          />
          <AdminStatCard
            title={isRTL ? 'اعضای فعال' : 'Active Members'}
            value={status.counts.members_active}
            icon={Users}
            color="#00ffff"
          />
          <AdminStatCard
            title={isRTL ? 'پست‌ها' : 'Posts'}
            value={status.counts.posts}
            icon={Newspaper}
            color="#00ffff"
          />
          <AdminStatCard
            title={isRTL ? 'مشارکت‌ها' : 'Contributions'}
            value={status.counts.contributions}
            icon={HandCoins}
            color="#10b981"
          />
          <AdminStatCard
            title={isRTL ? 'هزینه‌ها' : 'Expenses'}
            value={status.counts.expenses}
            icon={Receipt}
            color="#ef4444"
          />
          <AdminStatCard
            title={isRTL ? 'نظرات در انتظار تأیید' : 'Pending Comments'}
            value={status.counts.pending_comments}
            icon={MessageSquare}
            color="#fbbf24"
          />
        </div>
      </div>
    </div>
  );
}
