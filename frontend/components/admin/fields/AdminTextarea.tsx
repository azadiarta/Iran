'use client';
import { forwardRef, useState } from 'react';
import { useTransientError } from '@/hooks/useFieldFeedback';

interface AdminTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const AdminTextarea = forwardRef<HTMLTextAreaElement, AdminTextareaProps>(
  ({ label, error, className = '', rows = 4, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    const feedback = useTransientError(error);

    const borderColor =
      feedback.status === 'error'
        ? '#ef4444'
        : feedback.status === 'success'
        ? '#10b981'
        : focused
        ? '#00ffff'
        : 'rgba(255,255,255,0.1)';
    const boxShadow =
      feedback.status === 'idle' && focused
        ? '0 0 12px rgba(0,255,255,0.15)'
        : feedback.status === 'success'
        ? '0 0 12px rgba(16,185,129,0.15)'
        : 'none';

    return (
      <div>
        {label && <label className="block text-xs text-white/50 mb-1.5">{label}</label>}
        <textarea
          ref={ref}
          rows={rows}
          {...props}
          className={`w-full px-4 py-2.5 rounded-xl bg-white/5 border text-white placeholder-white/20 outline-none transition-all resize-none ${className}`}
          style={{ borderColor, boxShadow }}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
        />
        {(feedback.message || typeof props.maxLength === 'number') && (
          <div className="mt-1 flex items-start justify-between gap-2">
            {feedback.message ? (
              <p
                className="text-xs transition-colors duration-300"
                style={{ color: feedback.status === 'success' ? '#10b981' : '#ef4444' }}
              >
                {feedback.message}
              </p>
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
