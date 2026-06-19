'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Eye, CheckCircle2, RotateCcw } from 'lucide-react';
import AdminTable, { AdminTableColumn } from '@/components/admin/AdminTable';
import AdminBadge from '@/components/admin/AdminBadge';
import AdminModal from '@/components/admin/AdminModal';
import AdminSelect from '@/components/admin/fields/AdminSelect';
import AdminInput from '@/components/admin/fields/AdminInput';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { contactAPI, ContactMessage, Paginated } from '@/lib/api';

export default function AdminContactMessagesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const { hasPermission, member: currentMember } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const canManage = !!currentMember?.is_superuser || hasPermission('can_manage_contact_messages');

  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [handledFilter, setHandledFilter] = useState<'' | 'true' | 'false'>('');
  const [memberFilterId, setMemberFilterId] = useState(searchParams.get('member') || '');
  const [memberFilterName, setMemberFilterName] = useState(searchParams.get('name') || '');

  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<ContactMessage | null>(null);

  function load() {
    setLoading(true);
    contactAPI
      .getList(page, { search: appliedSearch || undefined, is_handled: handledFilter || undefined, sender: memberFilterId || undefined })
      .then((res) => {
        const data = res.data as unknown as Paginated<ContactMessage>;
        setMessages(data.results);
        setHasNext(!!data.next);
        setTotalCount(data.count);
      })
      .catch(() => showToast('error', isRTL ? 'بارگذاری پیام‌ها ناموفق بود' : 'Failed to load messages'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (canManage) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, page, appliedSearch, handledFilter, memberFilterId]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  }

  function clearMemberFilter() {
    setMemberFilterId('');
    setMemberFilterName('');
    setPage(1);
    router.replace(`/${locale}/admin/contact-messages`);
  }

  async function toggleHandled(m: ContactMessage) {
    setToggleLoadingId(m.id);
    try {
      await contactAPI.toggleHandled(m.id);
      showToast(
        'success',
        m.is_handled
          ? isRTL ? 'پیام به‌عنوان رسیدگی‌نشده علامت خورد' : 'Message marked as unhandled'
          : isRTL ? 'پیام به‌عنوان رسیدگی‌شده علامت خورد' : 'Message marked as handled'
      );
      load();
      if (detailItem?.id === m.id) {
        setDetailItem({ ...detailItem, is_handled: !detailItem.is_handled });
      }
    } catch {
      showToast('error', isRTL ? 'انجام عملیات ناموفق بود' : 'Action failed');
    } finally {
      setToggleLoadingId(null);
    }
  }

  function openDetail(m: ContactMessage) {
    setDetailItem(m);
    setDetailModalOpen(true);
  }

  if (!canManage) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'شما دسترسی مدیریت پیام‌های تماس را ندارید.' : 'You do not have permission to manage contact messages.'}
      </div>
    );
  }

  const columns: AdminTableColumn<ContactMessage>[] = [
    { key: 'name', header: isRTL ? 'نام' : 'Name', render: (m) => <span className="text-white/80 text-sm">{m.name}</span> },
    {
      key: 'tracking_code',
      header: isRTL ? 'کد پیگیری' : 'Tracking Code',
      render: (m) => <span className="text-white/50 text-xs font-mono">{m.tracking_code}</span>,
    },
    { key: 'contact_info', header: isRTL ? 'راه ارتباطی' : 'Contact Info', render: (m) => <span className="text-white/60 text-xs">{m.contact_info}</span> },
    {
      key: 'message',
      header: isRTL ? 'پیام' : 'Message',
      render: (m) => <span className="text-white/60 text-xs truncate max-w-[16rem] block">{m.message}</span>,
    },
    {
      key: 'sender',
      header: isRTL ? 'فرستنده' : 'Sender',
      render: (m) => (
        <span className="text-white/40 text-xs">
          {m.sender_label || '—'}
          {m.sender_member_number && <span> (#{m.sender_member_number})</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: isRTL ? 'وضعیت' : 'Status',
      render: (m) => (
        <AdminBadge
          status={m.is_handled ? 'active' : 'pending'}
          label={m.is_handled ? (isRTL ? 'رسیدگی‌شده' : 'Handled') : (isRTL ? 'رسیدگی‌نشده' : 'Unhandled')}
        />
      ),
    },
    {
      key: 'created_at',
      header: isRTL ? 'زمان' : 'Time',
      render: (m) => <span className="text-white/40 text-xs">{new Date(m.created_at).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (m) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => openDetail(m)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
            style={{ border: '1px solid rgba(0,255,255,0.25)', color: '#00ffff', backgroundColor: 'rgba(0,255,255,0.06)' }}
            aria-label={isRTL ? 'جزئیات' : 'Details'}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => toggleHandled(m)}
            disabled={toggleLoadingId === m.id}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all disabled:opacity-50"
            style={
              m.is_handled
                ? { border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.04)' }
                : { border: '1px solid rgba(16,185,129,0.35)', color: '#10b981', backgroundColor: 'rgba(16,185,129,0.06)' }
            }
          >
            {m.is_handled ? <RotateCcw className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {m.is_handled ? (isRTL ? 'بازگردانی' : 'Revert') : (isRTL ? 'رسیدگی‌شده' : 'Mark Handled')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-white">{isRTL ? 'پیام‌های تماس' : 'Contact Messages'}</h1>
        <p className="text-sm text-white/40 mt-1">
          {isRTL ? 'پیام‌های ارسالی از فرم تماس با ما را بررسی کنید' : 'Review messages submitted through the Contact Us form'}
        </p>
      </div>

      {memberFilterId && (
        <div className="admin-glass-card p-3 flex items-center justify-between gap-3" style={{ border: '1px solid rgba(0,255,255,0.25)' }}>
          <span className="text-sm text-white/70">
            {isRTL ? `نمایش پیام‌های عضو: ${memberFilterName || memberFilterId}` : `Showing messages from member: ${memberFilterName || memberFilterId}`}
          </span>
          <button onClick={clearMemberFilter} className="text-xs font-medium underline" style={{ color: '#00ffff' }}>
            {isRTL ? 'پاک‌کردن فیلتر' : 'Clear filter'}
          </button>
        </div>
      )}

      <form onSubmit={applySearch} className="admin-glass-card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <AdminInput label={isRTL ? 'جست‌وجو' : 'Search'} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        <AdminSelect
          label={isRTL ? 'وضعیت' : 'Status'}
          value={handledFilter}
          onChange={(e) => { setHandledFilter(e.target.value as '' | 'true' | 'false'); setPage(1); }}
          options={[
            { value: '', label: isRTL ? 'همه' : 'All' },
            { value: 'false', label: isRTL ? 'رسیدگی‌نشده' : 'Unhandled' },
            { value: 'true', label: isRTL ? 'رسیدگی‌شده' : 'Handled' },
          ]}
        />
        <button
          type="submit"
          className="rounded-xl px-5 py-2.5 text-sm font-bold transition-all"
          style={{ backgroundColor: '#00ffff', color: '#0a0a0f', boxShadow: '0 0 16px rgba(0,255,255,0.3)' }}
        >
          {isRTL ? 'جست‌وجو' : 'Search'}
        </button>
      </form>

      <AdminTable
        columns={columns}
        data={messages}
        loading={loading}
        rowKey={(m) => m.id}
        emptyMessage={isRTL ? 'پیامی یافت نشد' : 'No messages found'}
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

      <AdminModal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title={isRTL ? 'جزئیات پیام' : 'Message Details'} maxWidth="max-w-2xl">
        {detailItem && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'نام' : 'Name'}</span>
                <span className="text-white/80 text-sm">{detailItem.name}</span>
              </div>
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'راه ارتباطی' : 'Contact Info'}</span>
                <span className="text-white/80 text-sm">{detailItem.contact_info}</span>
              </div>
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'کد پیگیری' : 'Tracking Code'}</span>
                <span className="text-white/80 text-sm font-mono">{detailItem.tracking_code}</span>
              </div>
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'فرستنده' : 'Sender'}</span>
                <span className="text-white/60 text-sm">
                  {detailItem.sender_label || '—'}
                  {detailItem.sender_member_number && (
                    <span className="text-white/40 text-xs"> (#{detailItem.sender_member_number})</span>
                  )}
                </span>
              </div>
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'وضعیت' : 'Status'}</span>
                <AdminBadge
                  status={detailItem.is_handled ? 'active' : 'pending'}
                  label={detailItem.is_handled ? (isRTL ? 'رسیدگی‌شده' : 'Handled') : (isRTL ? 'رسیدگی‌نشده' : 'Unhandled')}
                />
              </div>
              <div>
                <span className="block text-xs text-white/40 mb-1">{isRTL ? 'تاریخ ارسال' : 'Submitted'}</span>
                <span className="text-white/60 text-xs">{new Date(detailItem.created_at).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}</span>
              </div>
              {detailItem.is_handled && detailItem.handled_by_label && (
                <div>
                  <span className="block text-xs text-white/40 mb-1">{isRTL ? 'رسیدگی توسط' : 'Handled By'}</span>
                  <span className="text-white/60 text-xs">
                    {detailItem.handled_by_label}
                    {detailItem.handled_at ? ` · ${new Date(detailItem.handled_at).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}` : ''}
                  </span>
                </div>
              )}
            </div>

            <div>
              <span className="block text-xs text-white/40 mb-1">{isRTL ? 'متن پیام' : 'Message'}</span>
              <p className="text-white/70 text-sm whitespace-pre-wrap">{detailItem.message}</p>
            </div>

            <div className="flex items-center gap-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                type="button"
                onClick={() => toggleHandled(detailItem)}
                disabled={toggleLoadingId === detailItem.id}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
                style={
                  detailItem.is_handled
                    ? { border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.04)' }
                    : { border: '1px solid rgba(16,185,129,0.35)', color: '#10b981', backgroundColor: 'rgba(16,185,129,0.06)' }
                }
              >
                {detailItem.is_handled ? <RotateCcw className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {detailItem.is_handled ? (isRTL ? 'بازگردانی به رسیدگی‌نشده' : 'Revert to Unhandled') : (isRTL ? 'علامت به‌عنوان رسیدگی‌شده' : 'Mark as Handled')}
              </button>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}
