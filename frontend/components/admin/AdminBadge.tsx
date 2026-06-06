'use client';

export type AdminBadgeStatus =
  | 'pending'
  | 'pending_review'
  | 'completed'
  | 'failed'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'inactive';

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  pending:        { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
  pending_review: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
  completed:      { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
  approved:       { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
  active:         { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
  failed:         { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)' },
  rejected:       { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)' },
  inactive:       { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)' },
};

const DEFAULT_STYLE = { color: '#00ffff', bg: 'rgba(0,255,255,0.1)', border: 'rgba(0,255,255,0.3)' };

interface AdminBadgeProps {
  status: string;
  label?: string;
}

export default function AdminBadge({ status, label }: AdminBadgeProps) {
  const style = STATUS_STYLES[status] || DEFAULT_STYLE;
  const text = label || status.replace(/_/g, ' ');

  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium capitalize whitespace-nowrap"
      style={{ color: style.color, backgroundColor: style.bg, border: `1px solid ${style.border}` }}
    >
      {text}
    </span>
  );
}
