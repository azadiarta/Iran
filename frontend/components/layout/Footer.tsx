'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LionAndSun } from '@/components/animations/IranianSymbols';

interface FooterProps {
  locale: 'en' | 'fa';
}

export default function Footer({ locale }: FooterProps) {
  const t = useTranslations('footer');
  const tNav = useTranslations('nav');

  const isRTL = locale === 'fa';
  const fontFamily = isRTL ? 'Vazirmatn, sans-serif' : 'Inter, sans-serif';

  const navLinks = [
    { href: `/${locale}/posts`, label: tNav('posts') },
    { href: `/${locale}/expenses`, label: tNav('expenses') },
    { href: `/${locale}/help`, label: tNav('help') },
    { href: `/${locale}/contact`, label: tNav('contact') },
  ];

  return (
    <footer
      style={{
        backgroundColor: 'rgba(10,10,15,0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        width: '100%',
        marginTop: 'auto',
      }}
    >
      <div
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="flex flex-col items-center gap-5">
          {/* Animated lion with glow */}
          <div
            style={{
              color: '#fbbf24',
            }}
          >
            <LionAndSun size={48} animated />
          </div>

          {/* Slogan */}
          <p
            style={{
              fontFamily,
              fontSize: '1.125rem',
              fontWeight: 700,
              color: '#fbbf24',
              textShadow:
                '0 0 10px rgba(251,191,36,0.8), 0 0 20px rgba(251,191,36,0.4), 0 0 40px rgba(251,191,36,0.15)',
              letterSpacing: isRTL ? '0.05em' : '0.1em',
              textAlign: 'center',
            }}
          >
            {t('slogan')}
          </p>

          {/* Nav links */}
          <nav className="flex items-center gap-6 flex-wrap justify-center">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm transition-colors duration-200"
                style={{
                  color: 'rgba(255,255,255,0.5)',
                  fontFamily,
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.color = '#00ffff')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)')
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Copyright */}
          <p
            style={{
              fontFamily,
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.3)',
              textAlign: 'center',
            }}
          >
            &copy; {new Date().getFullYear()} {t('copyright')}
          </p>

          {/* Dedication */}
          <p
            style={{
              fontFamily,
              fontSize: '0.7rem',
              color: 'rgba(255,255,255,0.25)',
              textAlign: 'center',
            }}
          >
            {t('dedication')}
          </p>
        </div>
      </div>
    </footer>
  );
}
