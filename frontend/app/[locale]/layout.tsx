import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import ClientLayout from './ClientLayout';

const locales = ['en', 'fa'];

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!locales.includes(locale)) notFound();

  const messages = await getMessages();
  const dir = locale === 'fa' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body className="bg-[#0a0a0f] text-white antialiased min-h-screen flex flex-col">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ClientLayout locale={locale as 'en' | 'fa'}>
            {children}
          </ClientLayout>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
