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
  type: 'select' | 'toggle' | 'number' | 'text';
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
  contact_email: {
    label: { en: 'Contact Email', fa: 'ایمیل تماس' },
    description: {
      en: 'Public contact email shown on the Contact Us page.',
      fa: 'ایمیل تماسی که در صفحه تماس با ما نمایش داده می‌شود.',
    },
    type: 'text',
  },
  contact_phone: {
    label: { en: 'Contact Phone', fa: 'تلفن تماس' },
    description: {
      en: 'Public contact phone number shown on the Contact Us page.',
      fa: 'شماره تلفن تماسی که در صفحه تماس با ما نمایش داده می‌شود.',
    },
    type: 'text',
  },
  auth_sync_interval_seconds: {
    label: { en: 'Session Sync Interval (seconds)', fa: 'فاصله همگام‌سازی نشست (ثانیه)' },
    description: {
      en: 'How often signed-in clients re-fetch their own profile and permissions in the background.',
      fa: 'هر چند ثانیه یک‌بار، کاربران واردشده به‌صورت خودکار پروفایل و دسترسی‌های خود را به‌روزرسانی کنند.',
    },
    type: 'number',
  },
  landing_headline_en: {
    label: { en: 'Homepage Headline (English)', fa: 'تیتر صفحه اصلی (انگلیسی)' },
    description: {
      en: 'Main headline shown at the top of the homepage, in English.',
      fa: 'تیتر اصلی که در بالای صفحه اصلی سایت، به زبان انگلیسی نمایش داده می‌شود.',
    },
    type: 'text',
  },
  landing_headline_fa: {
    label: { en: 'Homepage Headline (Farsi)', fa: 'تیتر صفحه اصلی (فارسی)' },
    description: {
      en: 'Main headline shown at the top of the homepage, in Farsi.',
      fa: 'تیتر اصلی که در بالای صفحه اصلی سایت، به زبان فارسی نمایش داده می‌شود.',
    },
    type: 'text',
  },
  landing_tagline_en: {
    label: { en: 'Homepage Tagline (English)', fa: 'شعار صفحه اصلی (انگلیسی)' },
    description: {
      en: 'Short tagline shown below the homepage headline, in English.',
      fa: 'شعار کوتاهی که زیر تیتر صفحه اصلی، به زبان انگلیسی نمایش داده می‌شود.',
    },
    type: 'text',
  },
  landing_tagline_fa: {
    label: { en: 'Homepage Tagline (Farsi)', fa: 'شعار صفحه اصلی (فارسی)' },
    description: {
      en: 'Short tagline shown below the homepage headline, in Farsi.',
      fa: 'شعار کوتاهی که زیر تیتر صفحه اصلی، به زبان فارسی نمایش داده می‌شود.',
    },
    type: 'text',
  },
};

// Bilingual metadata for the payment settings rendered on /admin/payments.

export interface PaymentSettingMeta {
  label: { en: string; fa: string };
  description: { en: string; fa: string };
}

export const PAYMENT_SETTINGS_META: Record<string, PaymentSettingMeta> = {
  payment_manual_bank_name: {
    label: { en: 'Bank Name', fa: 'نام بانک' },
    description: {
      en: 'Bank name shown to contributors for manual bank transfers.',
      fa: 'نام بانکی که برای انتقال بانکی دستی به مشارکت‌کنندگان نمایش داده می‌شود.',
    },
  },
  payment_manual_account_name: {
    label: { en: 'Account Holder Name', fa: 'نام صاحب حساب' },
    description: {
      en: 'Account holder name shown to contributors for manual bank transfers.',
      fa: 'نام صاحب حساب که برای انتقال بانکی دستی به مشارکت‌کنندگان نمایش داده می‌شود.',
    },
  },
  payment_manual_account_number: {
    label: { en: 'Account Number', fa: 'شماره حساب' },
    description: {
      en: 'Account number shown to contributors for manual bank transfers.',
      fa: 'شماره حسابی که برای انتقال بانکی دستی به مشارکت‌کنندگان نمایش داده می‌شود.',
    },
  },
  payment_manual_sort_code: {
    label: { en: 'Sort Code', fa: 'کد شعبه (Sort Code)' },
    description: {
      en: 'Sort code shown to contributors for manual bank transfers.',
      fa: 'کد شعبه (Sort Code) که برای انتقال بانکی دستی به مشارکت‌کنندگان نمایش داده می‌شود.',
    },
  },
  payment_manual_reference_prefix: {
    label: { en: 'Reference Prefix', fa: 'پیشوند کد پیگیری' },
    description: {
      en: 'Prefix used to generate payment reference codes for manual transfers.',
      fa: 'پیشوندی که برای ساخت کدهای پیگیری پرداخت‌های انتقال بانکی دستی استفاده می‌شود.',
    },
  },
  payment_manual_instructions: {
    label: { en: 'Instructions', fa: 'راهنمای پرداخت' },
    description: {
      en: 'Extra instructions shown to contributors for manual bank transfers.',
      fa: 'راهنمای تکمیلی که برای انتقال بانکی دستی به مشارکت‌کنندگان نمایش داده می‌شود.',
    },
  },
  payment_paypal_email: {
    label: { en: 'PayPal Email', fa: 'ایمیل پی‌پل' },
    description: {
      en: 'PayPal email shown to contributors.',
      fa: 'ایمیل پی‌پلی که به مشارکت‌کنندگان نمایش داده می‌شود.',
    },
  },
  payment_paypal_me_link: {
    label: { en: 'PayPal.me Link', fa: 'لینک PayPal.me' },
    description: {
      en: 'paypal.me link shown to contributors.',
      fa: 'لینک paypal.me که به مشارکت‌کنندگان نمایش داده می‌شود.',
    },
  },
  payment_paypal_instructions: {
    label: { en: 'Instructions', fa: 'راهنمای پرداخت' },
    description: {
      en: 'Extra instructions shown to contributors for PayPal payments.',
      fa: 'راهنمای تکمیلی که برای پرداخت از طریق پی‌پل به مشارکت‌کنندگان نمایش داده می‌شود.',
    },
  },
};
