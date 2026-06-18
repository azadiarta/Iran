'use client';
import { useEffect } from 'react';
import { authAPI } from '@/lib/api';
import useAuthStore, { Member } from '@/store/authStore';

const SYNC_INTERVAL_MS = 30_000;

// Keeps the persisted member (permissions, group, is_active) fresh so that
// permission/group changes and deactivation made by an admin take effect
// without requiring the affected member to log out and back in.
export default function AuthSync() {
  const { hasHydrated, isAuthenticated, setMember } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;

    let cancelled = false;
    async function sync() {
      try {
        const res = await authAPI.getProfile();
        if (!cancelled) setMember(res.data as unknown as Member);
      } catch {
        // 401s are already handled by the shared axios interceptor (logout on failed refresh).
      }
    }

    sync();
    const interval = setInterval(sync, SYNC_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [hasHydrated, isAuthenticated, setMember]);

  return null;
}
