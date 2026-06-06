'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface AdminConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
}

export default function AdminConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
}: AdminConfirmDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[95] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(5,5,10,0.8)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />

          <motion.div
            className="relative w-full max-w-sm rounded-2xl admin-glass-card p-6 text-center"
            style={{ borderColor: 'rgba(239,68,68,0.25)' }}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)', boxShadow: '0 0 24px rgba(239,68,68,0.2)' }}
            >
              <AlertTriangle className="w-7 h-7" style={{ color: '#ef4444' }} />
            </div>

            <h3 className="text-base font-bold text-white mb-2">{title}</h3>
            <p className="text-sm text-white/60 mb-6">{message}</p>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm text-white/70 transition-all disabled:opacity-50"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                style={{
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  boxShadow: '0 0 24px rgba(239,68,68,0.3)',
                }}
              >
                {loading ? '…' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
