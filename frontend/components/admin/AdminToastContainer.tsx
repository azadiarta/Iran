'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import useToastStore, { ToastType } from '@/store/toastStore';

const TOAST_STYLES: Record<ToastType, { color: string; bg: string; border: string; Icon: typeof CheckCircle }> = {
  success: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', Icon: CheckCircle },
  error:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  Icon: XCircle },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', Icon: AlertTriangle },
  info:    { color: '#00ffff', bg: 'rgba(0,255,255,0.1)',  border: 'rgba(0,255,255,0.3)',  Icon: Info },
};

export default function AdminToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="fixed top-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm"
      style={{ insetInlineEnd: '1rem' }}
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const { color, bg, border, Icon } = TOAST_STYLES[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-3 rounded-xl p-4 backdrop-blur-xl"
              style={{ backgroundColor: bg, border: `1px solid ${border}`, boxShadow: `0 4px 24px ${bg}` }}
            >
              <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color }} />
              <p className="text-sm text-white/90 flex-1">{toast.message}</p>
              <button
                onClick={() => dismiss(toast.id)}
                className="flex-shrink-0 text-white/40 hover:text-white/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
