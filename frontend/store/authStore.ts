import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Member {
  id: string;
  full_name: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  group_name: string | null;
  group_permissions: string[];
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
  deactivation_reason?: string;
  deactivated_by_name?: string | null;
}

interface AuthState {
  member: Member | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  permissions: string[];
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  login: (member: Member, tokens: { access: string; refresh: string }) => void;
  logout: () => void;
  setTokens: (access: string, refresh: string) => void;
  setMember: (member: Member) => void;
  hasPermission: (codename: string) => boolean;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      member: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      permissions: [],
      hasHydrated: false,

      setHasHydrated: (v) => {
        set({ hasHydrated: v });
      },

      login: (member, tokens) => {
        set({
          member,
          accessToken: tokens.access,
          refreshToken: tokens.refresh,
          isAuthenticated: true,
          permissions: member.group_permissions || [],
        });
      },

      logout: () => {
        set({
          member: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          permissions: [],
        });
      },

      setTokens: (access, refresh) => {
        set({ accessToken: access, refreshToken: refresh });
      },

      setMember: (member) => {
        set({
          member,
          permissions: member.group_permissions || [],
        });
      },

      hasPermission: (codename) => {
        const { member, permissions } = get();
        if (member?.is_superuser) return true;
        return permissions.includes('*') || permissions.includes(codename);
      },
    }),
    {
      name: 'groupfund-auth',
      partialize: (state) => ({
        member: state.member,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        permissions: state.permissions,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export default useAuthStore;
