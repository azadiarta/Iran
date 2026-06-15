'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

export default function ImageLightbox({
  src,
  alt,
  onClose,
  hintText,
}: {
  src: string;
  alt: string;
  onClose: () => void;
  hintText?: string;
}) {
  useBodyScrollLock(true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain rounded-xl"
          style={{ maxHeight: '85vh' }}
        />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-11 h-11 rounded-full flex items-center justify-center text-white/70 transition-all duration-150 hover:text-white hover:scale-110"
          style={{
            background: 'rgba(0,0,0,0.6)',
            border: '1px solid rgba(0,255,255,0.3)',
            boxShadow: '0 0 12px rgba(0,255,255,0.15)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#00ffff';
            e.currentTarget.style.boxShadow = '0 0 18px rgba(0,255,255,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0,255,255,0.3)';
            e.currentTarget.style.boxShadow = '0 0 12px rgba(0,255,255,0.15)';
          }}
          aria-label="Close preview"
        >
          <X className="w-5 h-5" />
        </button>
        {hintText && (
          <p className="text-center text-white/30 text-xs mt-2">{hintText}</p>
        )}
      </div>
    </div>
  );
}
