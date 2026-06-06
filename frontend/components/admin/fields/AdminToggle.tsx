'use client';

interface AdminToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export default function AdminToggle({ checked, onChange, label, description, disabled }: AdminToggleProps) {
  return (
    <label className={`flex items-center justify-between gap-4 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      {(label || description) && (
        <span>
          {label && <span className="block text-sm text-white/80">{label}</span>}
          {description && <span className="block text-xs text-white/40 mt-0.5">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="relative flex-shrink-0 w-11 h-6 rounded-full transition-all"
        style={{
          backgroundColor: checked ? 'rgba(0,255,255,0.3)' : 'rgba(255,255,255,0.08)',
          border: `1px solid ${checked ? '#00ffff' : 'rgba(255,255,255,0.15)'}`,
          boxShadow: checked ? '0 0 12px rgba(0,255,255,0.3)' : 'none',
        }}
      >
        <span
          className="absolute top-1/2 w-4 h-4 rounded-full transition-all"
          style={{
            backgroundColor: checked ? '#00ffff' : 'rgba(255,255,255,0.5)',
            transform: checked
              ? 'translate(22px, -50%)'
              : 'translate(2px, -50%)',
            boxShadow: checked ? '0 0 8px rgba(0,255,255,0.6)' : 'none',
          }}
        />
      </button>
    </label>
  );
}
