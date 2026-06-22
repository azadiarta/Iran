'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Edit2, Trash2, Image as ImageIcon, X } from 'lucide-react';
import AdminTable, { AdminTableColumn } from '@/components/admin/AdminTable';
import AdminModal from '@/components/admin/AdminModal';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';
import AdminInput from '@/components/admin/fields/AdminInput';
import AdminTextarea from '@/components/admin/fields/AdminTextarea';
import AdminFileUpload from '@/components/admin/fields/AdminFileUpload';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { postsAPI, PostAdminDetail, PostDetail, Paginated } from '@/lib/api';
import { SHORT_TEXT_ADMIN_MAX_LENGTH, requiredFieldError } from '@/lib/validation';

export default function AdminPostsPage() {
  const params = useParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const { hasPermission, member: currentMember } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  // can_manage_permissions's own description covers "content moderation" —
  // it must be able to manage posts on its own, without also requiring can_post.
  const canPost = !!currentMember?.is_superuser || hasPermission('can_manage_permissions') || hasPermission('can_post');

  const [items, setItems] = useState<PostAdminDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 5;

  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PostDetail | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; body?: string }>({});

  function handleTitleChange(value: string) {
    setTitle(value);
    setFieldErrors((p) => ({ ...p, title: value.trim() ? undefined : requiredFieldError(isRTL) }));
  }

  function handleBodyChange(value: string) {
    setBody(value);
    setFieldErrors((p) => ({ ...p, body: value.trim() ? undefined : requiredFieldError(isRTL) }));
  }

  function validatePost(): boolean {
    const errors: { title?: string; body?: string } = {
      title: title.trim() ? undefined : requiredFieldError(isRTL),
      body: body.trim() ? undefined : requiredFieldError(isRTL),
    };
    setFieldErrors(errors);
    return !errors.title && !errors.body;
  }

  const [confirmDelete, setConfirmDelete] = useState<PostAdminDetail | null>(null);
  const [confirmDeleteImage, setConfirmDeleteImage] = useState<{ id: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  function load() {
    setLoading(true);
    postsAPI
      .getAdminList(page, { search: appliedSearch || undefined })
      .then((res) => {
        const data = res.data as unknown as Paginated<PostAdminDetail>;
        setItems(data.results);
        setHasNext(!!data.next);
        setTotalCount(data.count);
      })
      .catch(() => showToast('error', isRTL ? 'بارگذاری پست‌ها ناموفق بود' : 'Failed to load posts'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (canPost) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPost, page, appliedSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  function openCreate() {
    setEditing(null);
    setTitle('');
    setBody('');
    setImages([]);
    setFieldErrors({});
    setModalOpen(true);
  }

  async function openEdit(summary: PostAdminDetail) {
    try {
      const res = await postsAPI.getDetail(summary.id);
      const detail = (res.data as unknown as { post: PostDetail }).post;
      setEditing(detail);
      setTitle(detail.title);
      setBody(detail.body);
      setImages([]);
      setFieldErrors({});
      setModalOpen(true);
    } catch {
      showToast('error', isRTL ? 'بارگذاری پست ناموفق بود' : 'Failed to load post');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validatePost()) return;
    setSaving(true);
    try {
      if (editing) {
        await postsAPI.update(editing.id, { title, body });
        if (images.length > 0) {
          await postsAPI.uploadImages(editing.id, images);
        }
        showToast('success', isRTL ? 'پست با موفقیت ویرایش شد' : 'Post updated successfully');
      } else {
        await postsAPI.create({ title, body, images });
        showToast('success', isRTL ? 'پست با موفقیت منتشر شد' : 'Post published successfully');
      }
      setModalOpen(false);
      load();
    } catch {
      showToast('error', isRTL ? 'ذخیره پست ناموفق بود' : 'Failed to save post');
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setActionLoading(true);
    try {
      await postsAPI.delete(confirmDelete.id);
      showToast('success', isRTL ? 'پست با موفقیت حذف شد' : 'Post deleted successfully');
      setConfirmDelete(null);
      load();
    } catch {
      showToast('error', isRTL ? 'حذف پست ناموفق بود' : 'Failed to delete post');
    } finally {
      setActionLoading(false);
    }
  }

  async function doDeleteImage() {
    if (!confirmDeleteImage || !editing) return;
    setActionLoading(true);
    try {
      await postsAPI.deleteImage(editing.id, confirmDeleteImage.id);
      setEditing({ ...editing, images: editing.images.filter((img) => img.id !== confirmDeleteImage.id) });
      showToast('success', isRTL ? 'تصویر حذف شد' : 'Image removed');
      setConfirmDeleteImage(null);
    } catch {
      showToast('error', isRTL ? 'حذف تصویر ناموفق بود' : 'Failed to remove image');
    } finally {
      setActionLoading(false);
    }
  }

  if (!canPost) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'شما دسترسی مدیریت پست‌ها را ندارید.' : 'You do not have permission to manage posts.'}
      </div>
    );
  }

  const columns: AdminTableColumn<PostAdminDetail>[] = [
    { key: 'title', header: isRTL ? 'عنوان' : 'Title', render: (p) => <span className="text-white/80">{p.title}</span> },
    { key: 'tracking_code', header: isRTL ? 'کد پیگیری' : 'Tracking Code', render: (p) => <span className="text-white/50 text-xs font-mono">{p.tracking_code}</span> },
    { key: 'author', header: isRTL ? 'نویسنده' : 'Author', render: (p) => <span className="text-white/60">{p.author?.display_name || p.author?.full_name || '—'}</span> },
    {
      key: 'images',
      header: isRTL ? 'تصاویر' : 'Images',
      render: (p) => (
        <span className="flex items-center gap-1 text-xs text-white/50">
          <ImageIcon className="w-3.5 h-3.5" />
          {p.images?.length || 0}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: isRTL ? 'تاریخ' : 'Date',
      render: (p) => <span className="text-white/40 text-xs">{new Date(p.created_at).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-US')}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => openEdit(p)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
            style={{ border: '1px solid rgba(0,255,255,0.3)', color: '#00ffff', backgroundColor: 'rgba(0,255,255,0.05)' }}
          >
            <Edit2 className="w-3.5 h-3.5" />
            {isRTL ? 'ویرایش' : 'Edit'}
          </button>
          <button
            onClick={() => setConfirmDelete(p)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
            style={{ border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.05)' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{isRTL ? 'پست‌ها' : 'Posts'}</h1>
          <p className="text-sm text-white/40 mt-1">{isRTL ? 'مدیریت اخبار و اطلاعیه‌ها' : 'Manage news and announcements'}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all"
          style={{ backgroundColor: '#00ffff', color: '#0a0a0f', boxShadow: '0 0 16px rgba(0,255,255,0.3)' }}
        >
          <Plus className="w-4 h-4" />
          {isRTL ? 'پست جدید' : 'New Post'}
        </button>
      </div>

      <div className="admin-glass-card p-4">
        <AdminInput
          label={isRTL ? 'جست‌وجو' : 'Search'}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={isRTL ? 'عنوان، متن، نویسنده یا کد پیگیری...' : 'Title, body, author, or tracking code...'}
          maxLength={150}
        />
      </div>

      <AdminTable
        columns={columns}
        data={items}
        loading={loading}
        rowKey={(p) => p.id}
        emptyMessage={isRTL ? 'پستی یافت نشد' : 'No posts found'}
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

      <AdminModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? (isRTL ? 'ویرایش پست' : 'Edit Post') : (isRTL ? 'پست جدید' : 'New Post')} maxWidth="max-w-2xl">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <AdminInput label={isRTL ? 'عنوان' : 'Title'} value={title} onChange={(e) => handleTitleChange(e.target.value)} error={fieldErrors.title} required maxLength={SHORT_TEXT_ADMIN_MAX_LENGTH} />
          <AdminTextarea label={isRTL ? 'متن' : 'Body'} value={body} onChange={(e) => handleBodyChange(e.target.value)} error={fieldErrors.body} rows={6} required maxLength={550} />

          {editing && editing.images.length > 0 && (
            <div>
              <label className="block text-xs text-white/50 mb-1.5">{isRTL ? 'تصاویر فعلی' : 'Current Images'}</label>
              <div className="flex flex-wrap gap-2">
                {editing.images.map((img) => (
                  <div key={img.id} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.image} alt="" className="w-16 h-16 rounded-lg object-cover" style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteImage({ id: img.id })}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: '#ef4444', color: '#fff' }}
                      aria-label={isRTL ? 'حذف تصویر' : 'Remove image'}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <AdminFileUpload
            label={editing ? (isRTL ? 'افزودن تصاویر جدید' : 'Add New Images') : (isRTL ? 'تصاویر (اختیاری)' : 'Images (optional)')}
            accept="image/*"
            multiple
            onChange={setImages}
            isRTL={isRTL}
          />

          <div className="flex items-center gap-3 mt-1">
            <button
              type="submit"
              disabled={saving || !title.trim() || !body.trim()}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
              style={{ backgroundColor: '#00ffff', color: '#0a0a0f', boxShadow: '0 0 16px rgba(0,255,255,0.3)' }}
            >
              {saving ? (isRTL ? 'در حال ذخیره...' : 'Saving...') : editing ? (isRTL ? 'ذخیره تغییرات' : 'Save Changes') : (isRTL ? 'انتشار پست' : 'Publish Post')}
            </button>
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl px-5 py-2.5 text-sm font-medium text-white/60 hover:text-white/90 transition-colors">
              {isRTL ? 'انصراف' : 'Cancel'}
            </button>
          </div>
        </form>
      </AdminModal>

      <AdminConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        loading={actionLoading}
        title={isRTL ? 'حذف پست' : 'Delete Post'}
        message={isRTL ? `آیا از حذف «${confirmDelete?.title}» مطمئن هستید؟ این عمل غیرقابل بازگشت است.` : `Are you sure you want to delete "${confirmDelete?.title}"? This action is irreversible.`}
        confirmLabel={isRTL ? 'حذف کن' : 'Delete'}
        cancelLabel={isRTL ? 'انصراف' : 'Cancel'}
      />

      <AdminConfirmDialog
        isOpen={!!confirmDeleteImage}
        onClose={() => setConfirmDeleteImage(null)}
        onConfirm={doDeleteImage}
        loading={actionLoading}
        title={isRTL ? 'حذف تصویر' : 'Remove Image'}
        message={isRTL ? 'آیا از حذف این تصویر مطمئن هستید؟' : 'Are you sure you want to remove this image?'}
        confirmLabel={isRTL ? 'حذف کن' : 'Remove'}
        cancelLabel={isRTL ? 'انصراف' : 'Cancel'}
      />
    </div>
  );
}
