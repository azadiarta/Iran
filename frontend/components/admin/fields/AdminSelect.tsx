'use client';
import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface AdminSelectOption {
  value: string;
  label: string;
}

interface AdminSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  error?: string;
  options: AdminSelectOption[];
  placeholder?: string;
}

const AdminSelect = forwardRef<HTMLSelectElement, AdminSelectProps>(
  ({ label, error, options, placeholder, className = '', ...props }, ref) => {
    return (
      <div>
        {label && <label className="block text-xs text-white/50 mb-1.5">{label}</label>}
        <div className="relative">
          <select
            ref={ref}
            {...props}
            className={`w-full appearance-none px-4 py-2.5 pe-10 rounded-xl bg-white/5 border text-white outline-none transition-all cursor-pointer ${className}`}
            style={{ borderColor: error ? '#ef4444' : 'rgba(255,255,255,0.1)' }}
          >
            {placeholder && (
              <option value="" disabled style={{ background: '#0d0d14' }}>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ background: '#0d0d14' }}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute top-1/2 -translate-y-1/2 pointer-events-none text-white/30"
            style={{ insetInlineEnd: '0.9rem' }}
          />
        </div>
        {error && <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>{error}</p>}
      </div>
    );
  }
);

AdminSelect.displayName = 'AdminSelect';
export default AdminSelect;
