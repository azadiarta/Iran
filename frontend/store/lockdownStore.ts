import { create } from 'zustand';

// Not persisted on purpose — lockdown state must always reflect the server,
// never a stale value replayed from localStorage on next load.
interface LockdownState {
  kind: 'superuser' | 'permission' | null;
  message: string;
  hasLoaded: boolean;
  setStatus: (kind: 'superuser' | 'permission' | null, message: string) => void;
}

const useLockdownStore = create<LockdownState>()((set) => ({
  kind: null,
  message: '',
  hasLoaded: false,
  setStatus: (kind, message) => set({ kind, message, hasLoaded: true }),
}));

export default useLockdownStore;
