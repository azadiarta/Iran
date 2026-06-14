'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface AdminSelectWithDescriptionOption {
  value: string;
  label: string;
  description?: string;
}

interface AdminSelectWithDescriptionProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: AdminSelectWithDescriptionOption[];
  placeholder?: string;
  error?: string;
}

export default function AdminSelectWithDescription({ label, value, onChange, options, placeholder, error }: AdminSelectWithDescriptionProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="block text-xs text-white/50 mb-1.5">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-white/5 border text-start text-white outline-none transition-all"
        style={{ borderColor: error ? '#ef4444' : open ? 'rgba(0,255,255,0.4)' : 'rgba(255,255,255,0.1)' }}
      >
        <span className={`truncate ${selected ? 'text-white/90' : 'text-white/30'}`}>
          {selected ? selected.label : placeholder || ''}
        </span>
        <ChevronDown size={16} className={`flex-shrink-0 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute z-20 mt-1.5 w-full max-h-72 overflow-y-auto rounded-xl py-1.5"
          style={{ backgroundColor: '#0d0d14', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className="w-full flex items-start gap-2 px-4 py-2.5 text-start transition-colors hover:bg-white/[0.04]"
                style={{
                  backgroundColor: isSelected ? 'rgba(0,255,255,0.08)' : 'transparent',
                  borderInlineStart: isSelected ? '2px solid #00ffff' : '2px solid transparent',
                }}
              >
                <Check size={14} className="flex-shrink-0 mt-0.5" style={{ color: isSelected ? '#00ffff' : 'transparent' }} />
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className={`text-sm ${isSelected ? 'text-white' : 'text-white/80'}`}>{opt.label}</span>
                  {opt.description && <span className="text-xs text-white/40">{opt.description}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>{error}</p>}
    </div>
  );
}
