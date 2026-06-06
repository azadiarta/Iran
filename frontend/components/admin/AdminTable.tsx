'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { LionAndSun } from '@/components/animations/IranianSymbols';

export interface AdminTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface PaginationState {
  page: number;
  hasNext: boolean;
  hasPrev: boolean;
  onPageChange: (page: number) => void;
  pageLabel?: string;
}

interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  rowKey: (row: T) => string;
  pagination?: PaginationState;
  skeletonRows?: number;
}

export default function AdminTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data found',
  rowKey,
  pagination,
  skeletonRows = 6,
}: AdminTableProps<T>) {
  return (
    <div className="admin-glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-start px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/40 whitespace-nowrap ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5">
                      <div className="admin-skeleton h-4 w-24" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center">
                  <div style={{ color: 'rgba(255,255,255,0.15)' }} className="flex justify-center mb-3">
                    <LionAndSun size={56} />
                  </div>
                  <p className="text-white/30 text-sm">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3.5 align-middle ${col.className || ''}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && !loading && data.length > 0 && (
        <div
          className="flex items-center justify-between gap-4 px-4 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))}
            disabled={!pagination.hasPrev}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: pagination.hasPrev ? '#00ffff' : 'rgba(255,255,255,0.3)',
            }}
          >
            <ChevronLeft size={14} />
            Prev
          </button>

          <span className="text-white/40 text-xs">{pagination.pageLabel || `Page ${pagination.page}`}</span>

          <button
            onClick={() => pagination.onPageChange(pagination.page + 1)}
            disabled={!pagination.hasNext}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: pagination.hasNext ? '#00ffff' : 'rgba(255,255,255,0.3)',
            }}
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
