'use client';
import { motion } from 'framer-motion';

interface LockdownPageProps {
  locale: 'en' | 'fa';
  message: string;
}

// Full-screen overlay shown whenever a lockdown (superuser- or
// permission-kind) blocks the current visitor. Mirrors SplashScreen's
// visual language (dark #0a0a0f background, amber #fbbf24 glow, radial
// gradient + grid backdrop) but with its own sleepy lock mascot instead of
// the LionAndSun emblem — this page means "come back later", not "welcome".
export default function LockdownPage({ locale, message }: LockdownPageProps) {
  const isFa = locale === 'fa';
  const fontFamily = isFa ? 'Vazirmatn, sans-serif' : 'Inter, sans-serif';
  const title = isFa ? 'سامانه موقتاً خوابیده است…' : 'The site is taking a little nap…';
  const subtitle = isFa
    ? 'به‌زودی برمی‌گردیم. لطفاً کمی صبر کنید.'
    : "We'll be back soon. Thanks for your patience.";
  // The admin's message box is optional — fall back to this generic notice
  // so visitors always see something in the highlighted box, not a gap.
  const defaultMessage = isFa
    ? 'اطلاعات بیشتری در حال حاضر ارائه نشده است.'
    : 'No further details are available at this time.';
  const displayMessage = message || defaultMessage;

  return (
    <div
      dir={isFa ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '1.5rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(251,191,36,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(251,191,36,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.03) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 16 }}
        style={{ position: 'relative', marginBottom: '2rem' }}
      >
        <SleepyLock />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
        style={{
          fontFamily,
          fontSize: '1.6rem',
          fontWeight: 700,
          color: '#fbbf24',
          textShadow: '0 0 10px #fbbf24, 0 0 20px rgba(251,191,36,0.5)',
          marginBottom: '0.75rem',
          maxWidth: '32rem',
        }}
      >
        {title}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5, ease: 'easeOut' }}
        style={{ fontFamily, fontSize: '0.95rem', color: 'rgba(255,255,255,0.5)', marginBottom: '1.5rem' }}
      >
        {subtitle}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.5, ease: 'easeOut' }}
        style={{
          fontFamily,
          maxWidth: '32rem',
          padding: '1rem 1.5rem',
          borderRadius: '1rem',
          backgroundColor: 'rgba(251,191,36,0.06)',
          border: '1px solid rgba(251,191,36,0.25)',
          color: 'rgba(255,255,255,0.85)',
          fontSize: '0.95rem',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
        }}
      >
        {displayMessage}
      </motion.div>
    </div>
  );
}

/* ─── Sleepy lock mascot: closed crescent eyes, gentle breathing, floating Zs ── */

function SleepyLock() {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      style={{ position: 'relative', width: 140, height: 140 }}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 0, x: 0 }}
          animate={{ opacity: [0, 1, 0], y: -50 - i * 6, x: 14 + i * 10 }}
          transition={{
            duration: 2.6,
            repeat: Infinity,
            delay: i * 0.7,
            ease: 'easeOut',
          }}
          style={{
            position: 'absolute',
            top: 4,
            right: 0,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 800,
            fontSize: 14 + i * 3,
            color: '#fbbf24',
            textShadow: '0 0 8px rgba(251,191,36,0.7)',
          }}
        >
          Z
        </motion.span>
      ))}

      <motion.div
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: '100%',
          height: '100%',
          filter: 'drop-shadow(0 0 18px rgba(251,191,36,0.55))',
        }}
      >
        <svg viewBox="0 0 140 140" width="140" height="140" fill="none">
          <rect x="34" y="62" width="72" height="58" rx="16" fill="#fbbf24" />
          <path
            d="M50 62 V44 a20 20 0 0 1 40 0 V62"
            stroke="#fbbf24"
            strokeWidth="9"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="70" cy="92" r="22" fill="#0a0a0f" />
          <path d="M59 92 q5 6 11 0" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M70 92 q5 6 11 0" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M64 104 q6 5 12 0" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />
        </svg>
      </motion.div>
    </motion.div>
  );
}
