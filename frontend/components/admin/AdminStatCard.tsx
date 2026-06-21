'use client';
import { useEffect, useState } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';

interface AdminStatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color?: string;
  prefix?: string;
  suffix?: string;
  trend?: 'up' | 'down' | 'neutral';
  decimals?: number;
  locale?: string;
}

function CountUp({ value, decimals = 0, locale = 'en' }: { value: number; decimals?: number; locale?: string }) {
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 0.9,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplay(latest.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })),
    });
    return () => controls.stop();
  }, [value, decimals, locale, motionValue]);

  return <span>{display}</span>;
}

const TREND_ICON = { up: TrendingUp, down: TrendingDown, neutral: Minus };
const TREND_COLOR = { up: '#10b981', down: '#ef4444', neutral: 'rgba(255,255,255,0.4)' };

export default function AdminStatCard({
  title,
  value,
  icon: Icon,
  color = '#00ffff',
  prefix = '',
  suffix = '',
  trend,
  decimals = 0,
  locale = 'en',
}: AdminStatCardProps) {
  const TrendIcon = trend ? TREND_ICON[trend] : null;

  return (
    <motion.div
      className="admin-glass-card p-5 flex flex-col gap-3"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}1a`, boxShadow: `0 0 20px ${color}26` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {TrendIcon && (
          <TrendIcon className="w-4 h-4" style={{ color: TREND_COLOR[trend as 'up' | 'down' | 'neutral'] }} />
        )}
      </div>

      <div>
        <p className="text-xs text-white/50 mb-1">{title}</p>
        <p className="text-2xl font-black" style={{ color, textShadow: `0 0 16px ${color}40` }}>
          {prefix}
          <CountUp value={value} decimals={decimals} locale={locale} />
          {suffix}
        </p>
      </div>
    </motion.div>
  );
}
