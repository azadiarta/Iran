'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Edit2, Star, Trash2, Users, ShieldCheck } from 'lucide-react';
import AdminModal from '@/components/admin/AdminModal';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';
import AdminInput from '@/components/admin/fields/AdminInput';
import AdminTextarea from '@/components/admin/fields/AdminTextarea';
import AdminPermissionCheckbox, { PermissionOption } from '@/components/admin/fields/AdminPermissionCheckbox';
import { LionAndSun } from '@/components/animations/IranianSymbols';
import useAuthStore from '@/store/authStore';
import useToastStore from '@/store/toastStore';
import { groupsAPI, permissionsAPI, AccessGroup, Permission } from '@/lib/api';
import { PERMISSION_META } from '@/lib/permissionsMeta';

export default function AdminGroupsPage() {
  const params = useParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRTL = locale === 'fa';
  const { hasPermission, member: currentMember } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const canManage = !!currentMember?.is_superuser || hasPermission('can_manage_permissions');
  const isSuperuser = !!currentMember?.is_superuser;

  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AccessGroup | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['can_contribute', 'can_comment']);
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<AccessGroup | null>(null);
  const [confirmDefault, setConfirmDefault] = useState<AccessGroup | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  function load() {
    setLoading(true);
    groupsAPI
      .getList()
      .then((res) => setGroups(res.data as unknown as AccessGroup[]))
      .catch(() => showToast('error', isRTL ? 'بارگذاری گروه‌ها ناموفق بود' : 'Failed to load groups'))
      .finally(() => setLoading(false));
  }

  function loadPermissions() {
    permissionsAPI
      .getList()
      .then((res) => setAllPermissions(res.data as unknown as Permission[]))
      .catch(() => showToast('error', isRTL ? 'بارگذاری دسترسی‌ها ناموفق بود' : 'Failed to load permissions'));
  }

  useEffect(() => {
    if (canManage) {
      load();
      loadPermissions();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  function openCreate() {
    setEditing(null);
    setName('');
    setDescription('');
    setSelectedPermissions(['can_contribute', 'can_comment']);
    setModalOpen(true);
  }

  function openEdit(g: AccessGroup) {
    setEditing(g);
    setName(g.name);
    setDescription(g.description);
    setSelectedPermissions(g.permissions.map((p) => p.codename));
    setModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await groupsAPI.update(editing.id, { name, description, permission_ids: selectedPermissions });
        showToast('success', isRTL ? 'گروه با موفقیت ویرایش شد' : 'Group updated successfully');
      } else {
        await groupsAPI.create({ name, description, permission_ids: selectedPermissions });
        showToast('success', isRTL ? 'گروه با موفقیت ایجاد شد' : 'Group created successfully');
      }
      setModalOpen(false);
      load();
    } catch {
      showToast('error', isRTL ? 'ذخیره گروه ناموفق بود' : 'Failed to save group');
    } finally {
      setSaving(false);
    }
  }

  async function doSetDefault() {
    if (!confirmDefault) return;
    setActionLoading(true);
    try {
      await groupsAPI.setDefault(confirmDefault.id);
      showToast('success', isRTL ? 'گروه پیش‌فرض تغییر کرد' : 'Default group changed');
      setConfirmDefault(null);
      load();
    } catch {
      showToast('error', isRTL ? 'تغییر گروه پیش‌فرض ناموفق بود' : 'Failed to set default group');
    } finally {
      setActionLoading(false);
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setActionLoading(true);
    try {
      await groupsAPI.delete(confirmDelete.id);
      showToast('success', isRTL ? 'گروه با موفقیت حذف شد' : 'Group deleted successfully');
      setConfirmDelete(null);
      load();
    } catch {
      showToast('error', isRTL ? 'حذف گروه ناموفق بود (ممکن است گروه پیش‌فرض باشد)' : 'Failed to delete group (it may be the default group)');
      setConfirmDelete(null);
    } finally {
      setActionLoading(false);
    }
  }

  if (!canManage) {
    return (
      <div className="admin-glass-card p-8 text-center text-white/50 text-sm">
        {isRTL ? 'شما دسترسی مدیریت گروه‌ها را ندارید.' : 'You do not have permission to manage groups.'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{isRTL ? 'گروه‌های دسترسی' : 'Access Groups'}</h1>
          <p className="text-sm text-white/40 mt-1">{isRTL ? 'مدیریت گروه‌ها و سطوح دسترسی' : 'Manage groups and permission levels'}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all"
          style={{ backgroundColor: '#00ffff', color: '#0a0a0f', boxShadow: '0 0 16px rgba(0,255,255,0.3)' }}
        >
          <Plus className="w-4 h-4" />
          {isRTL ? 'گروه جدید' : 'New Group'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <LionAndSun size={48} animated />
        </div>
      ) : groups.length === 0 ? (
        <div className="admin-glass-card p-8 text-center text-white/40 text-sm">
          {isRTL ? 'گروهی یافت نشد' : 'No groups found'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <div key={g.id} className="admin-glass-card p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-white/90 flex items-center gap-2 truncate">
                    {g.name}
                    {g.is_default && <Star className="w-4 h-4 flex-shrink-0" style={{ color: '#fbbf24' }} fill="#fbbf24" />}
                  </h3>
                  <p className="text-xs text-white/40 mt-1 line-clamp-2">{g.description || '—'}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-white/50">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {g.member_count} {isRTL ? 'عضو' : 'members'}
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {g.permissions.length} {isRTL ? 'دسترسی' : 'permissions'}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {g.permissions.slice(0, 4).map((p) => (
                  <span
                    key={p.codename}
                    className="text-[10px] px-2 py-1 rounded-md"
                    style={{ backgroundColor: 'rgba(0,255,255,0.06)', border: '1px solid rgba(0,255,255,0.2)', color: '#00ffff' }}
                  >
                    {PERMISSION_META[p.codename]
                      ? (isRTL ? PERMISSION_META[p.codename].label.fa : PERMISSION_META[p.codename].label.en)
                      : p.label}
                  </span>
                ))}
                {g.permissions.length > 4 && (
                  <span className="text-[10px] px-2 py-1 rounded-md text-white/40">+{g.permissions.length - 4}</span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => openEdit(g)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                  style={{ border: '1px solid rgba(0,255,255,0.3)', color: '#00ffff', backgroundColor: 'rgba(0,255,255,0.05)' }}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  {isRTL ? 'ویرایش' : 'Edit'}
                </button>
                {isSuperuser && !g.is_default && (
                  <button
                    onClick={() => setConfirmDefault(g)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                    style={{ border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.05)' }}
                  >
                    <Star className="w-3.5 h-3.5" />
                    {isRTL ? 'پیش‌فرض' : 'Set Default'}
                  </button>
                )}
                {isSuperuser && !g.is_default && (
                  <button
                    onClick={() => setConfirmDelete(g)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                    style={{ border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.05)' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isRTL ? 'حذف' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AdminModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? (isRTL ? 'ویرایش گروه' : 'Edit Group') : (isRTL ? 'گروه جدید' : 'New Group')} maxWidth="max-w-2xl">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <AdminInput label={isRTL ? 'نام گروه' : 'Group Name'} value={name} onChange={(e) => setName(e.target.value)} required />
          <AdminTextarea label={isRTL ? 'توضیحات' : 'Description'} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          <div>
            <label className="block text-xs text-white/50 mb-1.5">{isRTL ? 'دسترسی‌ها' : 'Permissions'}</label>
            <AdminPermissionCheckbox permissions={allPermissions} selected={selectedPermissions} onChange={setSelectedPermissions} isRTL={isRTL} />
          </div>
          <div className="flex items-center gap-3 mt-1">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
              style={{ backgroundColor: '#00ffff', color: '#0a0a0f', boxShadow: '0 0 16px rgba(0,255,255,0.3)' }}
            >
              {saving ? (isRTL ? 'در حال ذخیره...' : 'Saving...') : editing ? (isRTL ? 'ذخیره تغییرات' : 'Save Changes') : (isRTL ? 'ایجاد گروه' : 'Create Group')}
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-white/60 hover:text-white/90 transition-colors"
            >
              {isRTL ? 'انصراف' : 'Cancel'}
            </button>
          </div>
        </form>
      </AdminModal>

      <AdminConfirmDialog
        isOpen={!!confirmDefault}
        onClose={() => setConfirmDefault(null)}
        onConfirm={doSetDefault}
        loading={actionLoading}
        title={isRTL ? 'تنظیم گروه پیش‌فرض' : 'Set Default Group'}
        message={isRTL ? `آیا «${confirmDefault?.name}» به‌عنوان گروه پیش‌فرض تنظیم شود؟` : `Set "${confirmDefault?.name}" as the default group for new members?`}
        confirmLabel={isRTL ? 'تنظیم' : 'Set Default'}
        cancelLabel={isRTL ? 'انصراف' : 'Cancel'}
      />

      <AdminConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        loading={actionLoading}
        title={isRTL ? 'حذف گروه' : 'Delete Group'}
        message={isRTL ? `آیا از حذف «${confirmDelete?.name}» مطمئن هستید؟ این عمل غیرقابل بازگشت است.` : `Are you sure you want to delete "${confirmDelete?.name}"? This action is irreversible.`}
        confirmLabel={isRTL ? 'حذف کن' : 'Delete'}
        cancelLabel={isRTL ? 'انصراف' : 'Cancel'}
      />
    </div>
  );
}
