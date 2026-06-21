'use client';
import { forwardRef } from 'react';

interface AdminTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const AdminTextarea = forwardRef<HTMLTextAreaElement, AdminTextareaProps>(
  ({ label, error, className = '', rows = 4, ...props }, ref) => {
    return (
      <div>
        {label && <label className="block text-xs text-white/50 mb-1.5">{label}</label>}
        <textarea
          ref={ref}
          rows={rows}
          {...props}
          className={`w-full px-4 py-2.5 rounded-xl bg-white/5 border text-white placeholder-white/20 outline-none transition-all resize-none ${className}`}
          style={{ borderColor: error ? '#ef4444' : 'rgba(255,255,255,0.1)' }}
          onFocus={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = '#00ffff';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(0,255,255,0.15)';
            }
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.boxShadow = 'none';
            }
            props.onBlur?.(e);
          }}
        />
        {(error || typeof props.maxLength === 'number') && (
          <div className="mt-1 flex items-start justify-between gap-2">
            {error ? (
              <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>
            ) : (
              <span />
            )}
            {typeof props.maxLength === 'number' && (
              <p className="text-xs text-white/30 whitespace-nowrap">
                {String(props.value ?? '').length}/{props.maxLength}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

AdminTextarea.displayName = 'AdminTextarea';
export default AdminTextarea;
