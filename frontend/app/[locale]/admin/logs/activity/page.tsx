'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Eye } from 'lucide-react';
import AdminTable, { AdminTableColumn } from '@/components/admin/AdminTable';
import AdminModal from '@/components/admin/AdminModal';
import AdminInput from '@/components/admin/fields/AdminInput';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { logsAPI, ActivityLogEntry, Paginated } from '@/lib/api';

export default function AdminActivityLogPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const { hasPermission, member: currentMember } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const canView = !!currentMember?.is_superuser || hasPermission('can_manage_permissions');

  const [items, setItems] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 25;

  const initialMemberFilter = searchParams.get('member') || '';
  const [actorFilter, setActorFilter] = useState(initialMemberFilter);
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ actor: initialMemberFilter, action: '', date_from: '', date_to: '' });
  const [memberFilterName, setMemberFilterName] = useState(searchParams.get('name') || '');

  const [detail, setDetail] = useState<ActivityLogEntry | null>(null);

  function load() {
    setLoading(true);
    const filters: Record<string, string> = {};
    if (appliedFilters.actor) filters.actor = appliedFilters.actor;
    if (appliedFilters.action) filters.action = appliedFilters.action;
    if (appliedFilters.date_from) filters.date_from = appliedFilters.date_from;
    if (appliedFilters.date_to) filters.date_to = appliedFilters.date_to;
    logsAPI
      .getActivity(page, filters)
      .then((res) => {
        const data = res.data as unknown as Paginated<ActivityLogEntry>;
        setItems(data.results);
        setHasNext(!!data.next);
        setTotalCount(data.count);
      })
      .catch(() => showToast('error', isRTL ? 'بارگذاری گزارش فعالیت ناموفق بود' : 'Failed to load activity log'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (canView) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, page, appliedFilters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedFilters({ actor: actorFilter.trim(), action: actionFilter.trim(), date_from: dateFrom, date_to: dateTo });
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [actorFilter, actionFilter, dateFrom, dateTo]);

  function clearMemberFilter() {
    setActorFilter('');
    setMemberFilterName('');
    setPage(1);
    setAppliedFilters((prev) => ({ ...prev, actor: '' }));
    router.replace(`/${locale}/admin/logs/activity`);
  }

  if (!canView) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'شما دسترسی مشاهده گزارش فعالیت را ندارید.' : 'You do not have permission to view the activity log.'}
      </div>
    );
  }

  const columns: AdminTableColumn<ActivityLogEntry>[] = [
    { key: 'actor', header: isRTL ? 'انجام‌دهنده' : 'Actor', render: (l) => <span className="text-white/80">{l.actor_display}</span> },
    { key: 'action', header: isRTL ? 'عملیات' : 'Action', render: (l) => <span className="text-white/60 text-xs font-mono">{l.action}</span> },
    { key: 'target', header: isRTL ? 'هدف' : 'Target', render: (l) => <span className="text-white/50 text-xs truncate max-w-[12rem] block">{l.target_display || '—'}</span> },
    { key: 'ip', header: 'IP', render: (l) => <span className="text-white/40 text-xs font-mono">{l.ip_address || '—'}</span> },
    {
      key: 'created_at',
      header: isRTL ? 'زمان' : 'Time',
      render: (l) => <span className="text-white/40 text-xs">{new Date(l.created_at).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (l) => (
        <button
          onClick={() => setDetail(l)}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
          style={{ border: '1px solid rgba(0,255,255,0.3)', color: '#00ffff', backgroundColor: 'rgba(0,255,255,0.05)' }}
        >
          <Eye className="w-3.5 h-3.5" />
          {isRTL ? 'جزئیات' : 'Details'}
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-white">{isRTL ? 'گزارش فعالیت' : 'Activity Log'}</h1>
        <p className="text-sm text-white/40 mt-1">{isRTL ? 'تاریخچه عملیات انجام‌شده توسط اعضا' : 'History of actions performed by members'}</p>
      </div>

      {memberFilterName && (
        <div className="admin-glass-card p-3 flex items-center justify-between gap-3" style={{ border: '1px solid rgba(0,255,255,0.25)' }}>
          <span className="text-sm text-white/70">
            {isRTL ? `نمایش فعالیت‌های عضو: ${memberFilterName}` : `Showing activity for member: ${memberFilterName}`}
          </span>
          <button onClick={clearMemberFilter} className="text-xs font-medium underline" style={{ color: '#00ffff' }}>
            {isRTL ? 'پاک‌کردن فیلتر' : 'Clear filter'}
          </button>
        </div>
      )}

      <div className="admin-glass-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <AdminInput label={isRTL ? 'انجام‌دهنده' : 'Actor'} value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} maxLength={150} />
        <AdminInput label={isRTL ? 'عملیات' : 'Action'} value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} maxLength={150} />
        <AdminInput label={isRTL ? 'از تاریخ' : 'Date From'} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <AdminInput label={isRTL ? 'تا تاریخ' : 'Date To'} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      <AdminTable
        columns={columns}
        data={items}
        loading={loading}
        rowKey={(l) => l.id}
        emptyMessage={isRTL ? 'رکوردی یافت نشد' : 'No records found'}
        pagination={{
          page,
          hasNext,
          hasPrev: page > 1,
          onPageChange: setPage,
          prevLabel: isRTL ? 'قبلی' : 'Prev',
          nextLabel: isRTL ? 'بعدی' : 'Next',
          pageLabel: isRTL
            ? `صفحه ${page} از ${Math.max(1, Math.ceil(totalCount / pageSize))}`
            : `Page ${page} of ${Math.max(1, Math.ceil(totalCount / pageSize))}`,
        }}
      />

      <AdminModal isOpen={!!detail} onClose={() => setDetail(null)} title={isRTL ? 'جزئیات فعالیت' : 'Activity Details'}>
        {detail && (
          <div className="flex flex-col gap-3 text-sm">
            <DetailRow label={isRTL ? 'انجام‌دهنده' : 'Actor'} value={detail.actor_display} />
            <DetailRow label={isRTL ? 'عملیات' : 'Action'} value={detail.action} mono />
            <DetailRow label={isRTL ? 'هدف' : 'Target'} value={detail.target_display || '—'} />
            <DetailRow label="IP" value={detail.ip_address || '—'} mono />
            <DetailRow label={isRTL ? 'زمان' : 'Time'} value={new Date(detail.created_at).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')} />
            {detail.extra_data && (
              <div>
                <p className="text-xs text-white/40 mb-1.5">{isRTL ? 'اطلاعات بیشتر' : 'Extra Data'}</p>
                <pre className="text-xs rounded-lg p-3 overflow-x-auto text-white/60" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {JSON.stringify(detail.extra_data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </AdminModal>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-white/[0.05] last:border-0">
      <span className="text-xs text-white/40 flex-shrink-0">{label}</span>
      <span className={`text-white/80 text-end break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
