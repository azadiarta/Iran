'use client';
import { useEffect } from 'react';
import { lockdownAPI, LockdownStatus } from '@/lib/api';
import useLockdownStore from '@/store/lockdownStore';

const POLL_INTERVAL_MS = 20_000;

// Unlike AuthSync, this runs unconditionally — anonymous visitors must also
// be told when the site is locked down. /api/lockdown/ is AllowAny and
// exempt from SiteLockdownMiddleware, so it always succeeds.
export default function LockdownSync() {
  const setStatus = useLockdownStore((s) => s.setStatus);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const res = await lockdownAPI.getStatus();
        const status = res.data as unknown as LockdownStatus;
        if (!cancelled) setStatus(status.kind, status.message);
      } catch {
        // Leave the last known state in place on transient failure.
      }
    }

    sync();
    const interval = setInterval(sync, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [setStatus]);

  return null;
}
