'use client';
import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { fundAPI } from '@/lib/api';
import type { FundBalance } from '@/lib/api';
import useAuthStore from '@/store/authStore';

function formatAmount(amount: number, currency: string) {
  const symbol =
    currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : `${currency} `;
  return `${symbol}${Number(amount).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function BalanceIndicator({ className }: { className?: string }) {
  const { hasPermission } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [balance, setBalance] = useState<FundBalance | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const canView = mounted && hasPermission('can_view_balance');

  useEffect(() => {
    if (!canView) return;
    fundAPI
      .getBalance()
      .then((res) => setBalance(res.data as unknown as FundBalance))
      .catch(() => setBalance(null));
  }, [canView]);

  if (!canView || !balance) return null;

  const color = balance.balance >= 0 ? '#10b981' : '#ef4444';

  return (
    <div
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap ${className || ''}`}
      style={{ border: `1px solid ${color}40`, backgroundColor: `${color}1a`, color }}
    >
      <Wallet size={14} />
      <span>{formatAmount(balance.balance, balance.currency)}</span>
    </div>
  );
}
