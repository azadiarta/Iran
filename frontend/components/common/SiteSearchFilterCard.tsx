'use client';
import { Search, X } from 'lucide-react';

interface SiteSearchFilterCardProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchMaxLength?: number;
  hasActiveFilters: boolean;
  onClear: () => void;
  clearLabel: string;
  children?: React.ReactNode;
  filtersClassName?: string;
}

// Shared look for every search/filter card on the main site, modeled on the
// Expenses page: icon-prefixed search input with a live length counter, an
// optional grid of extra filters below, and a conditional clear-filters link.
export default function SiteSearchFilterCard({
  search,
  onSearchChange,
  searchPlaceholder,
  searchMaxLength = 150,
  hasActiveFilters,
  onClear,
  clearLabel,
  children,
  filtersClassName = 'grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2',
}: SiteSearchFilterCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 mb-6">
      <div className="relative">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          maxLength={searchMaxLength}
          className="w-full rounded-xl pl-11 pr-4 py-2.5 text-white placeholder-white/30 outline-none transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        />
      </div>
      <div className="flex justify-end mt-1">
        <span className="text-xs text-white/30">{search.length}/{searchMaxLength}</span>
      </div>

      {children && <div className={filtersClassName}>{children}</div>}

      {hasActiveFilters && (
        <button
          onClick={onClear}
          className="mt-3 flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          {clearLabel}
        </button>
      )}
    </div>
  );
}

interface SiteFilterFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

// One labeled input for the filter grid inside SiteSearchFilterCard (date
// range, amount range, etc.) — kept visually identical to the search input.
export function SiteFilterField({ label, className = '', ...props }: SiteFilterFieldProps) {
  return (
    <div>
      <label className="block text-xs text-white/40 mb-1">{label}</label>
      <input
        {...props}
        className={`w-full rounded-xl px-3 py-2 text-white placeholder-white/30 outline-none transition-colors ${className}`}
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
      />
    </div>
  );
}
