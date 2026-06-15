// Bilingual metadata for access permissions, keyed by the `codename` values
// seeded in backend/core/management/commands/seed_initial_data.py.
// Used to render permission labels/descriptions in Persian when the UI is RTL.

export interface PermissionMeta {
  label: { en: string; fa: string };
  description: { en: string; fa: string };
}

export const PERMISSION_META: Record<string, PermissionMeta> = {
  can_contribute: {
    label: { en: 'Can Contribute', fa: 'امکان مشارکت' },
    description: {
      en: 'Submit financial contributions to the fund.',
      fa: 'ارسال مشارکت مالی به صندوق.',
    },
  },
  can_comment: {
    label: { en: 'Can Comment', fa: 'امکان ثبت نظر' },
    description: {
      en: 'Post comments on posts and expenses.',
      fa: 'ثبت نظر روی پست‌ها و هزینه‌ها.',
    },
  },
  can_post: {
    label: { en: 'Can Post', fa: 'مدیریت پست‌ها' },
    description: {
      en: 'Create, edit and delete posts and post images.',
      fa: 'ایجاد، ویرایش و حذف پست‌ها و تصاویر آن‌ها.',
    },
  },
  can_expense: {
    label: { en: 'Can Record Expenses', fa: 'ثبت هزینه' },
    description: {
      en: 'Record fund expenses/withdrawals.',
      fa: 'ثبت هزینه‌ها و برداشت‌های صندوق.',
    },
  },
  can_view_balance: {
    label: { en: 'Can View Fund Balance', fa: 'مشاهده موجودی صندوق' },
    description: {
      en: 'View the current fund balance.',
      fa: 'مشاهده موجودی فعلی صندوق.',
    },
  },
  can_view_posts: {
    label: { en: 'Can View Posts', fa: 'مشاهده پست‌ها' },
    description: {
      en: 'View posts when post visibility is restricted to members.',
      fa: 'مشاهده پست‌ها زمانی که دسترسی به آن‌ها فقط برای اعضا محدود شده باشد.',
    },
  },
  can_view_dashboard: {
    label: { en: 'Can View Dashboard', fa: 'مشاهده داشبورد' },
    description: {
      en: 'Access the admin dashboard overview and stats.',
      fa: 'دسترسی به نمای کلی و آمار داشبورد مدیریت.',
    },
  },
  can_approve_comments: {
    label: { en: 'Can Approve Comments', fa: 'تأیید نظرات' },
    description: {
      en: 'Approve, reject or delete pending comments.',
      fa: 'تأیید، رد یا حذف نظرات در انتظار بررسی.',
    },
  },
  can_delete_member: {
    label: { en: 'Can Delete Members', fa: 'حذف اعضا' },
    description: {
      en: 'Deactivate or remove member accounts.',
      fa: 'غیرفعال‌سازی یا حذف حساب کاربری اعضا.',
    },
  },
  can_change_any_password: {
    label: { en: 'Can Change Any Password', fa: 'تغییر رمز سایر اعضا' },
    description: {
      en: "Change another member's password.",
      fa: 'تغییر رمز عبور سایر اعضا.',
    },
  },
  can_manage_permissions: {
    label: { en: 'Can Manage Permissions', fa: 'مدیریت دسترسی‌ها' },
    description: {
      en: 'Full admin access: members, groups, permissions, settings, payments and content moderation.',
      fa: 'دسترسی کامل مدیریتی: اعضا، گروه‌ها، دسترسی‌ها، تنظیمات، پرداخت‌ها و نظارت بر محتوا.',
    },
  },
  can_manage_env_vars: {
    label: { en: 'Can Manage Environment Variables', fa: 'مدیریت متغیرهای محیطی' },
    description: {
      en: 'View and edit deployment/runtime configuration (environment variables) and reset them to auto-detected defaults.',
      fa: 'مشاهده و ویرایش تنظیمات محیطی/زمان‌اجرا (متغیرهای محیطی) و بازنشانی آن‌ها به مقادیر پیش‌فرض شناسایی‌شده.',
    },
  },
};
