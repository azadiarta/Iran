'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LionAndSun } from './IranianSymbols';

interface PageTransitionProps {
  children: React.ReactNode;
  locale: 'en' | 'fa';
}

export default function PageTransition({ children, locale }: PageTransitionProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const pathname = usePathname();
  const label = locale === 'fa' ? 'پاینده ایران' : 'Long Live Iran';

  return (
    <>
      {/* Transition overlay — shown briefly while exiting/entering */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            key="transition-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(10, 10, 15, 0.6)',
              backdropFilter: 'blur(4px)',
              pointerEvents: 'none',
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              style={{ color: '#fbbf24', marginBottom: '0.5rem' }}
            >
              <LionAndSun size={40} />
            </motion.div>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 500,
                color: '#fbbf24',
                textShadow: '0 0 8px rgba(251,191,36,0.6)',
                fontFamily: locale === 'fa' ? 'Vazirmatn, sans-serif' : 'Inter, sans-serif',
                letterSpacing: '0.06em',
              }}
            >
              {label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page content with fade + slide transition */}
      <AnimatePresence
        mode="wait"
        onExitComplete={() => setIsTransitioning(false)}
      >
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          onAnimationStart={(definition) => {
            // Show overlay on exit start
            if (
              definition &&
              typeof definition === 'object' &&
              'opacity' in definition &&
              (definition as { opacity?: number }).opacity === 0
            ) {
              setIsTransitioning(true);
            }
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
