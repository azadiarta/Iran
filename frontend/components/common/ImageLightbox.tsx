'use client';
import { useEffect } from 'react';

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
          className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          aria-label="Close preview"
        >
          ✕
        </button>
        {hintText && (
          <p className="text-center text-white/30 text-xs mt-2">{hintText}</p>
        )}
      </div>
    </div>
  );
}
