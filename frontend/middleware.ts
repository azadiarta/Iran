import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'fa'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export const config = {
  // Exclude the Django-proxied prefixes (see next.config.mjs rewrites())
  // so /admin, /i18n, /static and /media are never locale-redirected — only
  // the app's own (locale-prefixed) routes go through next-intl.
  matcher: ['/((?!api|admin|i18n|static|media|_next|_vercel|.*\\..*).*)'],
};
