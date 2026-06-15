'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export default function AdminModal({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }: AdminModalProps) {
  useBodyScrollLock(isOpen);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-8"
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
            className={`relative w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-2xl admin-glass-card p-6`}
            style={{ borderColor: 'rgba(0,255,255,0.2)' }}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-lg font-bold"
                style={{ color: '#00ffff', textShadow: '0 0 16px rgba(0,255,255,0.3)' }}
              >
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
