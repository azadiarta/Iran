// Bilingual metadata for general settings rendered on /admin/settings.
// Keeps option values (used by the backend's `_CHOICES` validation in
// core/settings_views.py) in sync with human-friendly bilingual labels.

export interface SettingOption {
  value: string;
  label: { en: string; fa: string };
  description: { en: string; fa: string };
}

export interface SettingMeta {
  label: { en: string; fa: string };
  description: { en: string; fa: string };
  type: 'select' | 'toggle' | 'number';
  options?: SettingOption[];
}

export const SETTINGS_META: Record<string, SettingMeta> = {
  default_currency: {
    label: { en: 'Default Currency', fa: 'واحد پول پیش‌فرض' },
    description: {
      en: 'The currency used by default across the site.',
      fa: 'واحد پولی که به‌طور پیش‌فرض در سراسر سایت استفاده می‌شود.',
    },
    type: 'select',
    options: [
      {
        value: 'GBP',
        label: { en: 'GBP — British Pound', fa: 'GBP — پوند بریتانیا' },
        description: { en: 'British Pound Sterling (£)', fa: 'پوند استرلینگ بریتانیا (£)' },
      },
      {
        value: 'USD',
        label: { en: 'USD — US Dollar', fa: 'USD — دلار آمریکا' },
        description: { en: 'United States Dollar ($)', fa: 'دلار آمریکا ($)' },
      },
      {
        value: 'EUR',
        label: { en: 'EUR — Euro', fa: 'EUR — یورو' },
        description: { en: 'Euro (€)', fa: 'یورو (€)' },
      },
    ],
  },
  expense_list_visibility: {
    label: { en: 'Expense List Visibility', fa: 'سطح دسترسی فهرست هزینه‌ها' },
    description: {
      en: 'Who can view the public expense list.',
      fa: 'مشخص می‌کند چه کسانی می‌توانند فهرست هزینه‌ها را ببینند.',
    },
    type: 'select',
    options: [
      {
        value: 'all',
        label: { en: 'Everyone', fa: 'همه' },
        description: { en: 'Visible to all visitors, including guests.', fa: 'برای همه بازدیدکنندگان، از جمله مهمان‌ها، نمایش داده می‌شود.' },
      },
      {
        value: 'members_only',
        label: { en: 'Members Only', fa: 'فقط اعضا' },
        description: { en: 'Only signed-in members can view this list.', fa: 'فقط اعضای واردشده می‌توانند این فهرست را ببینند.' },
      },
      {
        value: 'admin_only',
        label: { en: 'Admins Only', fa: 'فقط مدیران' },
        description: { en: 'Only staff with admin access can view this list.', fa: 'فقط مدیران سامانه می‌توانند این فهرست را ببینند.' },
      },
    ],
  },
  post_list_visibility: {
    label: { en: 'Post List Visibility', fa: 'سطح دسترسی فهرست پست‌ها' },
    description: {
      en: 'Who can view the list of posts.',
      fa: 'مشخص می‌کند چه کسانی می‌توانند فهرست پست‌ها را ببینند.',
    },
    type: 'select',
    options: [
      {
        value: 'all',
        label: { en: 'Everyone', fa: 'همه' },
        description: { en: 'Visible to all visitors, including guests.', fa: 'برای همه بازدیدکنندگان، از جمله مهمان‌ها، نمایش داده می‌شود.' },
      },
      {
        value: 'members_only',
        label: { en: 'Members Only', fa: 'فقط اعضا' },
        description: { en: 'Only signed-in members can view this list.', fa: 'فقط اعضای واردشده می‌توانند این فهرست را ببینند.' },
      },
      {
        value: 'group_based',
        label: { en: 'Group-based', fa: 'بر اساس گروه' },
        description: { en: "Visibility depends on each member's access group permissions.", fa: 'دسترسی بر اساس مجوزهای گروه دسترسی هر عضو تعیین می‌شود.' },
      },
    ],
  },
  member_profile_visibility: {
    label: { en: 'Member Profile Visibility', fa: 'سطح دسترسی پروفایل اعضا' },
    description: {
      en: 'Who can view member profiles.',
      fa: 'مشخص می‌کند چه کسانی می‌توانند پروفایل اعضا را ببینند.',
    },
    type: 'select',
    options: [
      {
        value: 'all',
        label: { en: 'Everyone', fa: 'همه' },
        description: { en: 'Visible to all visitors, including guests.', fa: 'برای همه بازدیدکنندگان، از جمله مهمان‌ها، نمایش داده می‌شود.' },
      },
      {
        value: 'members_only',
        label: { en: 'Members Only', fa: 'فقط اعضا' },
        description: { en: 'Only signed-in members can view profiles.', fa: 'فقط اعضای واردشده می‌توانند پروفایل‌ها را ببینند.' },
      },
      {
        value: 'group_based',
        label: { en: 'Group-based', fa: 'بر اساس گروه' },
        description: { en: "Visibility depends on each member's access group permissions.", fa: 'دسترسی بر اساس مجوزهای گروه دسترسی هر عضو تعیین می‌شود.' },
      },
    ],
  },
  require_comment_approval: {
    label: { en: 'Require Comment Approval', fa: 'نیاز به تأیید نظرات' },
    description: {
      en: 'New comments must be approved by a moderator before they appear publicly.',
      fa: 'نظرات جدید پیش از نمایش عمومی باید توسط یک مدیر تأیید شوند.',
    },
    type: 'toggle',
  },
  default_group: {
    label: { en: 'Default Access Group', fa: 'گروه دسترسی پیش‌فرض' },
    description: {
      en: 'New members are automatically assigned to this access group.',
      fa: 'اعضای جدید به‌طور خودکار به این گروه دسترسی اختصاص داده می‌شوند.',
    },
    type: 'select',
    // Options are populated dynamically from the access groups list.
  },
  max_receipt_image_size_mb: {
    label: { en: 'Max Receipt Image Size (MB)', fa: 'حداکثر حجم تصویر رسید (مگابایت)' },
    description: {
      en: 'The maximum allowed file size for uploaded receipt images, in megabytes.',
      fa: 'حداکثر حجم مجاز برای تصاویر رسید آپلودشده، بر حسب مگابایت.',
    },
    type: 'number',
  },
};
