'use client';
import { useEffect } from 'react';
import { authAPI, settingsAPI } from '@/lib/api';
import useAuthStore, { Member } from '@/store/authStore';

const DEFAULT_SYNC_INTERVAL_MS = 15_000;

// Keeps the persisted member (permissions, group, is_active) fresh so that
// permission/group changes and deactivation made by an admin take effect
// without requiring the affected member to log out and back in. The interval
// is admin-configurable via the `auth_sync_interval_seconds` setting.
export default function AuthSync() {
  const { hasHydrated, isAuthenticated, setMember } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function sync() {
      try {
        const res = await authAPI.getProfile();
        if (!cancelled) setMember(res.data as unknown as Member);
      } catch {
        // 401s are already handled by the shared axios interceptor (logout on failed refresh).
      }
    }

    async function start() {
      let intervalMs = DEFAULT_SYNC_INTERVAL_MS;
      const res = await settingsAPI.getPublicSettings();
      const results = res?.data as unknown as { key: string; value: string }[] | undefined;
      const setting = Array.isArray(results)
        ? results.find((s) => s.key === 'auth_sync_interval_seconds')
        : undefined;
      const seconds = setting ? parseInt(setting.value, 10) : NaN;
      if (!cancelled && Number.isFinite(seconds) && seconds > 0) {
        intervalMs = seconds * 1000;
      }
      if (cancelled) return;
      sync();
      interval = setInterval(sync, intervalMs);
    }

    start();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [hasHydrated, isAuthenticated, setMember]);

  return null;
}
