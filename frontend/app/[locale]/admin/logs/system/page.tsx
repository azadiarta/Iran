'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Eye } from 'lucide-react';
import AdminTable, { AdminTableColumn } from '@/components/admin/AdminTable';
import AdminModal from '@/components/admin/AdminModal';
import AdminBadge from '@/components/admin/AdminBadge';
import AdminInput from '@/components/admin/fields/AdminInput';
import AdminSelect from '@/components/admin/fields/AdminSelect';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { logsAPI, SystemLogEntry, Paginated } from '@/lib/api';

const LEVEL_STATUS: Record<string, string> = {
  info: 'active',
  warning: 'pending',
  error: 'failed',
  critical: 'failed',
};

export default function AdminSystemLogPage() {
  const params = useParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const { member: currentMember } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const isSuperuser = !!currentMember?.is_superuser;

  const [items, setItems] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 25;

  const [levelFilter, setLevelFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ level: '', source: '', date_from: '', date_to: '' });

  const [detail, setDetail] = useState<SystemLogEntry | null>(null);

  function load() {
    setLoading(true);
    const filters: Record<string, string> = {};
    if (appliedFilters.level) filters.level = appliedFilters.level;
    if (appliedFilters.source) filters.source = appliedFilters.source;
    if (appliedFilters.date_from) filters.date_from = appliedFilters.date_from;
    if (appliedFilters.date_to) filters.date_to = appliedFilters.date_to;
    logsAPI
      .getSystem(page, filters)
      .then((res) => {
        const data = res.data as unknown as Paginated<SystemLogEntry>;
        setItems(data.results);
        setHasNext(!!data.next);
        setTotalCount(data.count);
      })
      .catch(() => showToast('error', isRTL ? 'بارگذاری گزارش سیستم ناموفق بود' : 'Failed to load system log'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (isSuperuser) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperuser, page, appliedFilters]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setAppliedFilters({ level: levelFilter, source: sourceFilter, date_from: dateFrom, date_to: dateTo });
  }

  if (!isSuperuser) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'این بخش فقط برای مدیران ارشد در دسترس است.' : 'This section is only available to superusers.'}
      </div>
    );
  }

  const columns: AdminTableColumn<SystemLogEntry>[] = [
    { key: 'level', header: isRTL ? 'سطح' : 'Level', render: (l) => <AdminBadge status={LEVEL_STATUS[l.level] || l.level} label={l.level} /> },
    { key: 'source', header: isRTL ? 'منبع' : 'Source', render: (l) => <span className="text-white/60 text-xs font-mono">{l.source}</span> },
    { key: 'message', header: isRTL ? 'پیام' : 'Message', render: (l) => <span className="text-white/70 text-xs truncate max-w-[18rem] block">{l.message}</span> },
    { key: 'member', header: isRTL ? 'عضو مرتبط' : 'Related Member', render: (l) => <span className="text-white/40 text-xs">{l.related_member_name || '—'}</span> },
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
        <h1 className="text-2xl font-bold text-white">{isRTL ? 'گزارش سیستم' : 'System Log'}</h1>
        <p className="text-sm text-white/40 mt-1">{isRTL ? 'رویدادها و خطاهای سطح سیستم' : 'System-level events and errors'}</p>
      </div>

      <form onSubmit={applyFilters} className="admin-glass-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <AdminSelect
          label={isRTL ? 'سطح' : 'Level'}
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          options={[
            { value: '', label: isRTL ? 'همه سطوح' : 'All levels' },
            { value: 'info', label: isRTL ? 'اطلاعات' : 'Info' },
            { value: 'warning', label: isRTL ? 'هشدار' : 'Warning' },
            { value: 'error', label: isRTL ? 'خطا' : 'Error' },
            { value: 'critical', label: isRTL ? 'بحرانی' : 'Critical' },
          ]}
        />
        <AdminInput label={isRTL ? 'منبع' : 'Source'} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} maxLength={150} />
        <AdminInput label={isRTL ? 'از تاریخ' : 'Date From'} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <AdminInput label={isRTL ? 'تا تاریخ' : 'Date To'} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <button
          type="submit"
          className="rounded-xl px-5 py-2.5 text-sm font-bold transition-all"
          style={{ backgroundColor: '#00ffff', color: '#0a0a0f', boxShadow: '0 0 16px rgba(0,255,255,0.3)' }}
        >
          {isRTL ? 'فیلتر' : 'Filter'}
        </button>
      </form>

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

      <AdminModal isOpen={!!detail} onClose={() => setDetail(null)} title={isRTL ? 'جزئیات رویداد سیستم' : 'System Log Details'}>
        {detail && (
          <div className="flex flex-col gap-3 text-sm">
            <DetailRow label={isRTL ? 'سطح' : 'Level'} value={detail.level} />
            <DetailRow label={isRTL ? 'منبع' : 'Source'} value={detail.source} mono />
            <DetailRow label={isRTL ? 'پیام' : 'Message'} value={detail.message} />
            <DetailRow label={isRTL ? 'عضو مرتبط' : 'Related Member'} value={detail.related_member_name || '—'} />
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
