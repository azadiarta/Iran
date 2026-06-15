import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import '@/styles/globals.css';
import ClientLayout from './ClientLayout';

const locales = ['en', 'fa'];

export const metadata: Metadata = {
  title: 'Group Fund',
  description: 'Transparent community fund management',
};

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
