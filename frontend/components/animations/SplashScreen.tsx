'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LionAndSun, GeometricPattern } from './IranianSymbols';

interface SplashScreenProps {
  locale: 'en' | 'fa';
  onComplete: () => void;
}

export default function SplashScreen({ locale, onComplete }: SplashScreenProps) {
  // step: 0=hidden, 1=background, 2=lion, 3=text, 4=pattern, 5=fadeout, 6=done
  const [step, setStep] = useState(0);

  useEffect(() => {
    // If already shown this session, skip immediately
    if (typeof window !== 'undefined' && localStorage.getItem('splashShown')) {
      onComplete();
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => setStep(1), 300));
    timers.push(setTimeout(() => setStep(2), 1000));
    timers.push(setTimeout(() => setStep(3), 2000));
    timers.push(setTimeout(() => setStep(4), 2800));
    timers.push(setTimeout(() => setStep(5), 3300));
    timers.push(
      setTimeout(() => {
        setStep(6);
        if (typeof window !== 'undefined') {
          localStorage.setItem('splashShown', '1');
        }
        onComplete();
      }, 3800),
    );

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (step === 6) return null;

  const isFa = locale === 'fa';
  const line1 = isFa ? 'جاوید شاه' : 'Long Live the King';
  const line2 = isFa ? 'پاینده ایران' : 'Long Live Iran';
  const fontFamily = isFa ? 'Vazirmatn, sans-serif' : 'Inter, sans-serif';

  return (
    <AnimatePresence>
      {step >= 1 && step < 6 && (
        <motion.div
          key="splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: step === 5 ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: step === 5 ? 0.5 : 0.4 }}
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
          }}
        >
          {/* Subtle radial glow behind lion */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(251,191,36,0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* Grid background */}
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

          {/* LionAndSun */}
          <AnimatePresence>
            {step >= 2 && (
              <motion.div
                key="lion"
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                style={{ color: '#fbbf24', marginBottom: '2rem', position: 'relative' }}
              >
                <motion.div
                  animate={{
                    filter: [
                      'drop-shadow(0 0 8px #fbbf24)',
                      'drop-shadow(0 0 24px #fbbf24)',
                      'drop-shadow(0 0 8px #fbbf24)',
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <LionAndSun size={140} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Text lines */}
          <AnimatePresence>
            {step >= 3 && (
              <motion.div
                key="text"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <SplashTextLine
                  text={line1}
                  fontFamily={fontFamily}
                  fontSize="2rem"
                  delay={0}
                />
                <SplashTextLine
                  text={line2}
                  fontFamily={fontFamily}
                  fontSize="1.5rem"
                  delay={0.15}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* GeometricPattern radiating outward */}
          <AnimatePresence>
            {step >= 4 && (
              <motion.div
                key="pattern"
                initial={{ opacity: 0.9, scale: 0.5 }}
                animate={{ opacity: 0, scale: 2.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  color: '#fbbf24',
                  pointerEvents: 'none',
                }}
              >
                <GeometricPattern size={200} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Typewriter-style text line ─────────────────────────────────────────── */

interface SplashTextLineProps {
  text: string;
  fontFamily: string;
  fontSize: string;
  delay: number;
}

function SplashTextLine({ text, fontFamily, fontSize, delay }: SplashTextLineProps) {
  const chars = Array.from(text);

  return (
    <div
      style={{
        fontFamily,
        fontSize,
        fontWeight: 700,
        color: '#fbbf24',
        textShadow:
          '0 0 10px #fbbf24, 0 0 20px rgba(251,191,36,0.5), 0 0 40px rgba(251,191,36,0.2)',
        display: 'flex',
        direction: 'ltr',
        letterSpacing: '0.08em',
      }}
    >
      {chars.map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: delay + i * 0.04,
            duration: 0.15,
          }}
        >
          {char === ' ' ? ' ' : char}
        </motion.span>
      ))}
    </div>
  );
}
