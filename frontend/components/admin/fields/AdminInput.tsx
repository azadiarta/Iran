'use client';
import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTransientError } from '@/hooks/useFieldFeedback';

interface AdminInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  hideMessage?: boolean;
}

const AdminInput = forwardRef<HTMLInputElement, AdminInputProps>(
  ({ label, error, hint, hideMessage, className = '', type, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const feedback = useTransientError(error);
    const isPassword = type === 'password';

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
        <div className="relative">
          <input
            ref={ref}
            type={isPassword ? (revealed ? 'text' : 'password') : type}
            {...props}
            className={`w-full px-4 py-2.5 rounded-xl bg-white/5 border text-white placeholder-white/20 outline-none transition-all focus:ring-1 ${isPassword ? 'pr-12' : ''} ${className}`}
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
          {isPassword && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              disabled={props.disabled}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/80 transition-colors disabled:opacity-50"
              aria-label={revealed ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
        {!hideMessage && (feedback.message || hint || typeof props.maxLength === 'number') && (
          <div className="mt-1 flex items-start justify-between gap-2">
            {feedback.message ? (
              <p
                className="text-xs transition-colors duration-300"
                style={{ color: feedback.status === 'success' ? '#10b981' : '#ef4444' }}
              >
                {feedback.message}
              </p>
            ) : hint ? (
              <p className="text-xs text-white/30">{hint}</p>
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

AdminInput.displayName = 'AdminInput';
export default AdminInput;
