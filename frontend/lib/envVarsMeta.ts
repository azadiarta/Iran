// Bilingual metadata for /admin/env-vars, one entry per key in
// backend/core/runtime_config.py's ENV_VAR_REGISTRY.

export interface EnvVarSuggestion {
  value: string;
  label: { en: string; fa: string };
}

export interface EnvVarMeta {
  label: { en: string; fa: string };
  description: { en: string; fa: string };
  effect: { en: string; fa: string };
  suggested?: EnvVarSuggestion[];
}

export const ENV_VAR_SECTIONS: Record<string, { en: string; fa: string }> = {
  debug: { en: 'Debug Mode', fa: 'حالت دیباگ' },
  hosts: { en: 'Hosts, CORS & CSRF', fa: 'میزبان‌ها، CORS و CSRF' },
  https: { en: 'HTTPS', fa: 'HTTPS' },
  s3: { en: 'S3 Storage', fa: 'فضای ذخیره‌سازی S3' },
  secret_key: { en: 'Secret Key', fa: 'کلید مخفی (Secret Key)' },
  database: { en: 'Database', fa: 'پایگاه‌داده' },
  frontend: { en: 'Frontend Build Variables', fa: 'متغیرهای بیلد فرانت‌اند' },
  platform: { en: 'Platform', fa: 'پلتفرم' },
};

export const ENV_VAR_META: Record<string, EnvVarMeta> = {
  DEBUG: {
    label: { en: 'Debug Mode', fa: 'حالت دیباگ' },
    description: {
      en: 'Shows detailed error pages with stack traces when something goes wrong.',
      fa: 'در صورت بروز خطا، صفحات خطای کامل همراه با جزئیات فنی (stack trace) نمایش می‌دهد.',
    },
    effect: {
      en: 'Should be OFF in production — leaving it ON exposes sensitive internal details to visitors. Applies within ~30 seconds.',
      fa: 'باید در محیط عملیاتی خاموش باشد — روشن‌بودن آن اطلاعات حساس داخلی را به بازدیدکنندگان نشان می‌دهد. ظرف حدود ۳۰ ثانیه اعمال می‌شود.',
    },
    suggested: [
      { value: 'false', label: { en: 'Off (recommended)', fa: 'خاموش (پیشنهادی)' } },
      { value: 'true', label: { en: 'On (development only)', fa: 'روشن (فقط برای توسعه)' } },
    ],
  },
  ALLOWED_HOSTS_EXTRA: {
    label: { en: 'Extra Allowed Hosts', fa: 'میزبان‌های مجاز افزوده' },
    description: {
      en: 'Additional hostnames/domains — beyond the ones detected automatically — that this server accepts requests for.',
      fa: 'دامنه‌ها/میزبان‌های اضافی — علاوه بر مواردی که به‌صورت خودکار شناسایی شده‌اند — که این سرور درخواست برای آن‌ها را می‌پذیرد.',
    },
    effect: {
      en: 'Add a custom domain here if it was not auto-detected. Auto-detected hosts are always kept, so this can never lock you out of the admin panel. Applies within ~30 seconds.',
      fa: 'اگر دامنه‌ی اختصاصی شما به‌صورت خودکار شناسایی نشده، آن را اینجا اضافه کنید. میزبان‌های شناسایی‌شده‌ی خودکار همیشه حفظ می‌شوند، بنابراین این مورد هرگز دسترسی شما به پنل را قطع نمی‌کند. ظرف حدود ۳۰ ثانیه اعمال می‌شود.',
    },
  },
  CSRF_TRUSTED_ORIGINS_EXTRA: {
    label: { en: 'Extra Trusted Origins (CSRF)', fa: 'مبداهای مورد اعتماد افزوده (CSRF)' },
    description: {
      en: 'Additional full origins (e.g. https://example.com) trusted for form submissions to the Django admin and API.',
      fa: 'مبداهای کامل افزوده (مثلاً https://example.com) که برای ارسال فرم به پنل جنگو و API مورد اعتماد هستند.',
    },
    effect: {
      en: 'Needed if you access /admin/ from a custom domain not auto-detected. Must include the scheme (https://). Applies within ~30 seconds.',
      fa: 'در صورت دسترسی به /admin/ از دامنه‌ی اختصاصی که خودکار شناسایی نشده، لازم است. باید شامل scheme (https://) باشد. ظرف حدود ۳۰ ثانیه اعمال می‌شود.',
    },
  },
  CORS_ALLOWED_ORIGINS_EXTRA: {
    label: { en: 'Extra CORS Origins', fa: 'مبداهای CORS افزوده' },
    description: {
      en: 'Additional frontend origins allowed to call this API from a browser.',
      fa: 'مبداهای فرانت‌اند افزوده که اجازه دارند از مرورگر به این API درخواست بزنند.',
    },
    effect: {
      en: 'Only needed if you run a separate frontend deployment on a custom domain. Applies within ~30 seconds.',
      fa: 'فقط در صورتی لازم است که یک فرانت‌اند جدا روی دامنه‌ی اختصاصی اجرا کنید. ظرف حدود ۳۰ ثانیه اعمال می‌شود.',
    },
  },
  SECURE_SSL_REDIRECT: {
    label: { en: 'Force HTTPS Redirect', fa: 'هدایت اجباری به HTTPS' },
    description: {
      en: 'When on, every plain HTTP request is redirected to HTTPS.',
      fa: 'در صورت روشن‌بودن، هر درخواست HTTP به HTTPS هدایت می‌شود.',
    },
    effect: {
      en: 'Only enable if this service is reached directly over HTTPS (not behind a proxy that already terminates TLS) — otherwise it causes an infinite redirect loop. Requires a restart.',
      fa: 'فقط در صورتی روشن کنید که این سرویس مستقیماً از طریق HTTPS در دسترس باشد (نه پشت پراکسی‌ای که خود TLS را مدیریت می‌کند) — در غیر این صورت باعث حلقه‌ی بی‌پایان ریدایرکت می‌شود. نیاز به ری‌استارت دارد.',
    },
    suggested: [
      { value: 'false', label: { en: 'Off (recommended behind a proxy)', fa: 'خاموش (پیشنهادی پشت پراکسی)' } },
      { value: 'true', label: { en: 'On (direct HTTPS only)', fa: 'روشن (فقط HTTPS مستقیم)' } },
    ],
  },
  AWS_STORAGE_BUCKET_NAME: {
    label: { en: 'S3 Bucket Name', fa: 'نام باکت S3' },
    description: {
      en: 'Name of the S3-compatible bucket used for persistent media storage (post images, receipts).',
      fa: 'نام باکت سازگار با S3 که برای ذخیره‌ی دائمی فایل‌های رسانه‌ای (تصاویر پست‌ها، رسیدها) استفاده می‌شود.',
    },
    effect: {
      en: 'Leave empty to use local disk storage (lost on every redeploy on Railway). Set together with the access keys below. Requires a restart.',
      fa: 'برای استفاده از حافظه‌ی محلی (که در هر redeploy روی Railway از بین می‌رود) خالی بگذارید. باید همراه با کلیدهای دسترسی زیر تنظیم شود. نیاز به ری‌استارت دارد.',
    },
  },
  AWS_ACCESS_KEY_ID: {
    label: { en: 'S3 Access Key ID', fa: 'کلید دسترسی S3' },
    description: {
      en: 'Access key ID for the S3-compatible storage account.',
      fa: 'شناسه‌ی کلید دسترسی برای حساب ذخیره‌سازی سازگار با S3.',
    },
    effect: {
      en: 'Required together with the secret access key when a bucket name is set. Requires a restart.',
      fa: 'همراه با رمز کلید دسترسی، در صورت تعیین نام باکت لازم است. نیاز به ری‌استارت دارد.',
    },
  },
  AWS_SECRET_ACCESS_KEY: {
    label: { en: 'S3 Secret Access Key', fa: 'رمز کلید دسترسی S3' },
    description: {
      en: 'Secret access key for the S3-compatible storage account.',
      fa: 'رمز کلید دسترسی برای حساب ذخیره‌سازی سازگار با S3.',
    },
    effect: {
      en: 'Keep this private — anyone with it can read/write your storage bucket. Requires a restart.',
      fa: 'این مقدار را محرمانه نگه دارید — هر کس آن را داشته باشد می‌تواند باکت ذخیره‌سازی شما را بخواند/تغییر دهد. نیاز به ری‌استارت دارد.',
    },
  },
  AWS_S3_REGION_NAME: {
    label: { en: 'S3 Region', fa: 'منطقه‌ی S3' },
    description: {
      en: 'Region of the S3-compatible bucket (e.g. eu-west-2).',
      fa: 'منطقه‌ی باکت سازگار با S3 (مثلاً eu-west-2).',
    },
    effect: {
      en: "Must match the bucket's actual region or uploads/downloads will fail. Requires a restart.",
      fa: 'باید با منطقه‌ی واقعی باکت مطابقت داشته باشد، در غیر این صورت آپلود/دانلود با خطا مواجه می‌شود. نیاز به ری‌استارت دارد.',
    },
  },
  AWS_S3_ENDPOINT_URL: {
    label: { en: 'S3 Endpoint URL', fa: 'آدرس Endpoint S3' },
    description: {
      en: 'Custom endpoint URL for non-AWS S3-compatible providers (e.g. Cloudflare R2, Backblaze B2).',
      fa: 'آدرس endpoint اختصاصی برای ارائه‌دهندگان غیر AWS سازگار با S3 (مثل Cloudflare R2، Backblaze B2).',
    },
    effect: {
      en: 'Leave empty for real AWS S3. Requires a restart.',
      fa: 'برای AWS S3 واقعی خالی بگذارید. نیاز به ری‌استارت دارد.',
    },
  },
  AWS_S3_CUSTOM_DOMAIN: {
    label: { en: 'S3 Custom Domain (CDN)', fa: 'دامنه‌ی اختصاصی S3 (CDN)' },
    description: {
      en: "Custom domain (e.g. a CDN) serving the bucket's files.",
      fa: 'دامنه‌ی اختصاصی (مثلاً CDN) که فایل‌های باکت را سرویس می‌دهد.',
    },
    effect: {
      en: "Used to build public media URLs. Leave empty to use the bucket's default URL. Requires a restart.",
      fa: 'برای ساخت آدرس عمومی فایل‌های رسانه استفاده می‌شود؛ برای استفاده از آدرس پیش‌فرض باکت خالی بگذارید. نیاز به ری‌استارت دارد.',
    },
  },
  SECRET_KEY: {
    label: { en: 'Secret Key', fa: 'کلید مخفی (Secret Key)' },
    description: {
      en: "Django's cryptographic signing key, used for sessions, password reset tokens and similar.",
      fa: 'کلید رمزنگاری جنگو که برای نشست‌ها، توکن‌های بازنشانی رمز عبور و موارد مشابه استفاده می‌شود.',
    },
    effect: {
      en: 'Regenerating it immediately invalidates ALL existing sessions and signed tokens (everyone is logged out) and requires a restart to fully apply. Only do this if you suspect it has been leaked.',
      fa: 'بازتولید آن، همه‌ی نشست‌ها و توکن‌های امضاشده‌ی فعلی را فوراً نامعتبر می‌کند (همه از سیستم خارج می‌شوند) و برای اعمال کامل نیاز به ری‌استارت دارد. فقط در صورت احتمال افشای آن این کار را انجام دهید.',
    },
  },
  RAILWAY_ENVIRONMENT: {
    label: { en: 'Railway Environment', fa: 'محیط Railway' },
    description: {
      en: 'Whether this instance is running on Railway, and which environment.',
      fa: 'مشخص می‌کند که این نمونه روی Railway اجرا می‌شود یا نه، و در چه محیطی.',
    },
    effect: {
      en: 'Set automatically by Railway — cannot be changed from here.',
      fa: 'به‌صورت خودکار توسط Railway تعیین می‌شود — از این صفحه قابل تغییر نیست.',
    },
  },
  DATABASE_URL: {
    label: { en: 'Database Connection', fa: 'اتصال پایگاه‌داده' },
    description: {
      en: 'The database engine and connection currently in use (password masked).',
      fa: 'موتور پایگاه‌داده و اتصال فعلی (رمز عبور پنهان شده).',
    },
    effect: {
      en: "To change the database, set DATABASE_URL (or DB_NAME/DB_HOST/...) in your deployment platform's environment variables and redeploy — not changeable here, to avoid accidental data loss.",
      fa: 'برای تغییر پایگاه‌داده، DATABASE_URL (یا DB_NAME/DB_HOST/...) را در متغیرهای محیطی پلتفرم استقرار تنظیم و دوباره دیپلوی کنید — برای پیشگیری از از دست‌رفتن داده، از این صفحه قابل تغییر نیست.',
    },
  },
  NEXT_PUBLIC_API_URL: {
    label: { en: 'Frontend API URL', fa: 'آدرس API فرانت‌اند' },
    description: {
      en: 'Backend API base URL baked into the frontend at build time.',
      fa: 'آدرس پایه‌ی API بک‌اند که هنگام build در فرانت‌اند تعبیه شده است.',
    },
    effect: {
      en: 'Build-time value — changing it requires setting the env var on the frontend service and rebuilding/redeploying; it cannot take effect at runtime.',
      fa: 'این مقدار در زمان build تعبیه می‌شود — تغییر آن نیاز به تنظیم متغیر محیطی روی سرویس فرانت‌اند و rebuild/redeploy دارد و در زمان اجرا قابل تغییر نیست.',
    },
  },
  NEXT_PUBLIC_SITE_NAME: {
    label: { en: 'Site Name', fa: 'نام سایت' },
    description: {
      en: "Site name shown in the frontend's branding, baked in at build time.",
      fa: 'نام سایتی که در برندینگ فرانت‌اند نمایش داده می‌شود، در زمان build تعبیه شده است.',
    },
    effect: {
      en: 'Build-time value — requires setting the env var on the frontend service and rebuilding/redeploying.',
      fa: 'این مقدار در زمان build تعبیه می‌شود — نیاز به تنظیم متغیر محیطی روی سرویس فرانت‌اند و rebuild/redeploy دارد.',
    },
  },
  NEXT_PUBLIC_MEDIA_URL: {
    label: { en: 'Frontend Media URL', fa: 'آدرس رسانه‌ی فرانت‌اند' },
    description: {
      en: 'Base URL the frontend uses to resolve uploaded media (images, receipts), baked in at build time.',
      fa: 'آدرس پایه‌ای که فرانت‌اند برای نمایش فایل‌های رسانه‌ای آپلودشده (تصاویر، رسیدها) استفاده می‌کند، در زمان build تعبیه شده است.',
    },
    effect: {
      en: 'Build-time value — requires setting the env var on the frontend service and rebuilding/redeploying.',
      fa: 'این مقدار در زمان build تعبیه می‌شود — نیاز به تنظیم متغیر محیطی روی سرویس فرانت‌اند و rebuild/redeploy دارد.',
    },
  },
};
