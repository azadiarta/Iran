import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';

// ─── Response shape ───────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

// ─── Lazy store access (avoids circular-dependency at module load time) ───────
function getAuthStore() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../store/authStore').default;
}

// ─── Locale prefix helper ─────────────────────────────────────────────────────
function getLocalePrefix(): string {
  if (typeof window === 'undefined') return '/en';
  const lang = localStorage.getItem('lang') || 'en';
  return `/${lang}`;
}

// ─── Axios instance ───────────────────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

// ─── Request interceptor — attach Bearer token ────────────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const store = getAuthStore();
    const { accessToken } = store.getState();
    if (accessToken && config.headers) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Track whether a token refresh is already in flight ───────────────────────
let isRefreshing = false;
let pendingRequests: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function onRefreshed(token: string) {
  pendingRequests.forEach(({ resolve }) => resolve(token));
  pendingRequests = [];
}

function onRefreshFailed(err: unknown) {
  pendingRequests.forEach(({ reject }) => reject(err));
  pendingRequests = [];
}

// ─── Response interceptor ─────────────────────────────────────────────────────
// Backend wraps most payloads as { success, message, data }. Unwrap so that
// `response.data` is always the meaningful payload — paginated DRF responses
// ({count, next, previous, results}) and the auth endpoints (which return
// { tokens, member } directly) have no such wrapper and pass through untouched.
function unwrapApiResponse<T extends { data: unknown }>(response: T): T {
  const body = response.data;
  if (
    body &&
    typeof body === 'object' &&
    'success' in body &&
    'data' in body
  ) {
    response.data = (body as ApiResponse).data;
  }
  return response;
}

api.interceptors.response.use(
  (response) => unwrapApiResponse(response),
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    if (!error.response) {
      return Promise.reject(error);
    }

    const status: number = error.response.status;
    const prefix = getLocalePrefix();

    // ── 401: attempt token refresh ──────────────────────────────────────────
    // Many pages (home, posts, expenses) are reachable by guests and make
    // requests that legitimately 401 when a feature is members-only. Forcing
    // a hard redirect here would bounce guests off otherwise-public pages, so
    // we only clear stale auth state and let each page's own error handling
    // (or its auth guard, e.g. profile/admin layouts) decide what to do.
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const store = getAuthStore();
      const { refreshToken, setTokens, logout } = store.getState();

      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until the refresh resolves or fails
        return new Promise((resolve, reject) => {
          pendingRequests.push({
            resolve: (newToken: string) => {
              if (originalRequest.headers) {
                (originalRequest.headers as Record<string, string>)[
                  'Authorization'
                ] = `Bearer ${newToken}`;
              } else {
                originalRequest.headers = { Authorization: `Bearer ${newToken}` };
              }
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/api/auth/token/refresh/`,
          { refresh: refreshToken }
        );

        const newAccess: string = data.access;
        const newRefresh: string = data.refresh ?? refreshToken;

        setTokens(newAccess, newRefresh);
        onRefreshed(newAccess);
        isRefreshing = false;

        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>)[
            'Authorization'
          ] = `Bearer ${newAccess}`;
        } else {
          originalRequest.headers = {
            Authorization: `Bearer ${newAccess}`,
          };
        }

        return api(originalRequest);
      } catch (refreshErr) {
        isRefreshing = false;
        onRefreshFailed(refreshErr);
        const store2 = getAuthStore();
        store2.getState().logout();
        return Promise.reject(error);
      }
    }

    // ── 403: forbidden ──────────────────────────────────────────────────────
    // Left for callers to handle (e.g. posts/expenses list pages redirect to
    // /forbidden themselves for their primary fetch); a global redirect here
    // would bounce users off pages that merely have one restricted widget
    // (e.g. the balance card on the home page for members without
    // can_view_balance).

    // ── 404: not found ──────────────────────────────────────────────────────
    if (status === 404) {
      if (typeof window !== 'undefined') {
        window.location.href = `${prefix}/not-found`;
      }
      return Promise.reject(error);
    }

    // ── 503: service unavailable ────────────────────────────────────────────
    if (status === 503) {
      if (typeof window !== 'undefined') {
        window.location.href = `${prefix}/unavailable`;
      }
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// Auth API
// ═══════════════════════════════════════════════════════════════════════════════
export const authAPI = {
  register: (data: {
    full_name: string;
    display_name?: string;
    phone?: string;
    email?: string;
    password: string;
    password_confirm: string;
    captcha_token: string;
  }) => api.post<ApiResponse>('/api/auth/register/', data),

  login: (credential: string, password: string, captcha_token: string) =>
    api.post<ApiResponse>('/api/auth/login/', { credential, password, captcha_token }),

  logout: () => {
    const store = getAuthStore();
    const { refreshToken } = store.getState();
    return api.post<ApiResponse>('/api/auth/logout/', {
      refresh: refreshToken,
    });
  },

  getProfile: () => api.get<ApiResponse>('/api/auth/profile/'),

  refreshToken: (refresh: string) =>
    api.post<ApiResponse>('/api/auth/token/refresh/', { refresh }),
};

// ─── Posts types ──────────────────────────────────────────────────────────────
export interface PostAuthor {
  id: string;
  full_name: string;
  display_name: string;
}

export interface PostImage {
  id: string;
  image: string;
  uploaded_at: string;
}

export interface PostSummary {
  id: string;
  title: string;
  author: PostAuthor | null;
  created_at: string;
  images?: PostImage[];
}

export interface PostDetail extends PostSummary {
  body: string;
  updated_at: string;
  images: PostImage[];
}

// Admin-only — never present on the public Post/Comment shape, only on
// PostAdminDetail/CommentDetail (returned by admin-gated endpoints). Carries
// member_number for admin lookup.
export interface MemberAdminBrief {
  id: string;
  display_name: string | null;
  full_name: string;
  member_number: number;
}

// Admin-only — exposes tracking_code and the author's member_number, gated
// by can_post. Returned only by the admin post search/filter endpoint.
export interface PostAdminDetail extends Omit<PostDetail, 'author'> {
  tracking_code: string;
  author: MemberAdminBrief | null;
}

export type CommentStatus = 'pending' | 'approved' | 'rejected';

export interface Comment {
  id: string;
  author_label: string;
  guest_name: string | null;
  text: string;
  rating: number | null;
  status: CommentStatus;
  created_at: string;
}

export interface CommentDetail extends Comment {
  // Admin-only lookup code — never exposed to the comment's own author.
  tracking_code: string;
  author: MemberAdminBrief | null;
  rejection_reason: string;
  target_type: 'post' | 'expense';
  target_label: string | null;
  updated_at: string;
}

export interface MyComment {
  id: string;
  tracking_code: string;
  text: string;
  rating: number | null;
  status: CommentStatus;
  rejection_reason: string;
  target_type: 'post' | 'expense';
  target_label: string | null;
  created_at: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Posts API
// ═══════════════════════════════════════════════════════════════════════════════
export const postsAPI = {
  getList: (
    page = 1,
    filters: { search?: string; date_from?: string; date_to?: string } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (filters.search) params.set('search', filters.search);
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    return api.get<ApiResponse>(`/api/posts/?${params.toString()}`);
  },

  getDetail: (id: string) => api.get<ApiResponse>(`/api/posts/${id}/`),

  getComments: (id: string) =>
    api.get<ApiResponse>(`/api/posts/${id}/comments/`),

  createComment: (
    id: string,
    data: { text: string; rating?: number; guest_name?: string; captcha_token: string }
  ) => api.post<ApiResponse>(`/api/posts/${id}/comments/create/`, data),

  // ── Admin ──────────────────────────────────────────────────────────────
  getAdminList: (
    page = 1,
    filters: { search?: string; author?: string; date_from?: string; date_to?: string } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (filters.search) params.set('search', filters.search);
    if (filters.author) params.set('author', filters.author);
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    return api.get<ApiResponse>(`/api/posts/admin/?${params.toString()}`);
  },

  create: (data: { title: string; body: string; images?: File[] }) => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('body', data.body);
    (data.images || []).forEach((file) => formData.append('images', file));
    return api.post<ApiResponse>('/api/posts/create/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  update: (id: string, data: { title?: string; body?: string }) =>
    api.patch<ApiResponse>(`/api/posts/${id}/update/`, data),

  delete: (id: string) => api.delete<ApiResponse>(`/api/posts/${id}/delete/`),

  uploadImages: (id: string, images: File[]) => {
    const formData = new FormData();
    images.forEach((file) => formData.append('images', file));
    return api.post<ApiResponse>(`/api/posts/${id}/images/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteImage: (id: string, imageId: string) =>
    api.delete<ApiResponse>(`/api/posts/${id}/images/${imageId}/delete/`),
};

// ═══════════════════════════════════════════════════════════════════════════════
// Comments API (admin moderation — target-agnostic actions)
// ═══════════════════════════════════════════════════════════════════════════════
export const commentsAPI = {
  getList: (
    page = 1,
    filters: { status?: CommentStatus; target_type?: 'post' | 'expense'; search?: string; author?: string } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (filters.status) params.set('status', filters.status);
    if (filters.target_type) params.set('target_type', filters.target_type);
    if (filters.search) params.set('search', filters.search);
    if (filters.author) params.set('author', filters.author);
    return api.get<ApiResponse>(`/api/posts/comments/?${params.toString()}`);
  },

  getDetail: (id: string) => api.get<ApiResponse>(`/api/posts/comments/${id}/`),

  updateStatus: (id: string, status: 'approved' | 'rejected') =>
    api.patch<ApiResponse>(`/api/posts/comments/${id}/status/`, { status }),

  update: (id: string, data: Partial<{
    text: string;
    rating: number | null;
    status: CommentStatus;
    rejection_reason: string;
  }>) => api.patch<ApiResponse>(`/api/posts/comments/${id}/edit/`, data),

  updateMine: (id: string, data: Partial<{ text: string; rating: number | null }>) =>
    api.patch<ApiResponse>(`/api/posts/comments/${id}/update/`, data),

  getMine: (page = 1) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    return api.get<ApiResponse>(`/api/posts/comments/mine/?${params.toString()}`);
  },
};

// ─── Fund types ───────────────────────────────────────────────────────────────
export interface FundBalance {
  total_contributions: number;
  total_expenses: number;
  balance: number;
  currency: string;
}

export interface MemberMinimal {
  id: string;
  display_name: string;
  full_name: string;
  // Admin-only — only populated by admin-gated endpoints (e.g. contribution/
  // comment admin detail views). Never present on public-facing responses.
  member_number?: number;
}

export type ContributionDisplayNameChoice = 'hidden' | 'display_name' | 'full_name' | 'custom';

export interface Contribution {
  id: string;
  tracking_code: string;
  contributor: MemberMinimal | null;
  guest_name: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: 'pending' | 'pending_review' | 'completed' | 'failed';
  notes: string;
  created_at: string;
  // Present on admin detail/edit responses
  receipt_image?: string | null;
  show_in_public_list?: boolean;
  display_name_choice?: ContributionDisplayNameChoice;
  public_display_name?: string;
  message?: string;
  rejection_reason?: string;
  updated_at?: string;
}

export interface ContributionPublic {
  id: string;
  display_name: string | null;
  amount: number;
  currency: string;
  message: string;
  created_at: string;
}

export interface MyContribution {
  id: string;
  tracking_code: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: 'pending' | 'pending_review' | 'completed' | 'failed';
  rejection_reason: string;
  message: string;
  created_at: string;
}

export interface Expense {
  id: string;
  withdrawn_by: MemberMinimal | null;
  amount: number;
  short_reason: string;
  description: string;
  receipt_image: string | null;
  expense_date: string;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fund API
// ═══════════════════════════════════════════════════════════════════════════════
export const fundAPI = {
  getBalance: () => api.get<ApiResponse>('/api/fund/balance/'),

  getContributions: (
    page = 1,
    filters: { status?: string; payment_method?: string; date_from?: string; date_to?: string; contributor?: string; search?: string } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (filters.status) params.set('status', filters.status);
    if (filters.payment_method) params.set('payment_method', filters.payment_method);
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    if (filters.contributor) params.set('contributor', filters.contributor);
    if (filters.search) params.set('search', filters.search);
    return api.get<ApiResponse>(`/api/fund/contributions/?${params.toString()}`);
  },

  createManualContribution: (data: {
    guest_name: string;
    amount: number;
    currency?: string;
    payment_method?: string;
    status?: string;
    notes?: string;
  }) => api.post<ApiResponse>('/api/fund/contributions/create-manual/', data),

  updateContributionStatus: (id: string, status: 'completed' | 'failed') =>
    api.patch<ApiResponse>(`/api/fund/contributions/${id}/status/`, { status }),

  getContributionsPublic: (page = 1) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    return api.get<ApiResponse>(`/api/fund/contributions/public/?${params.toString()}`);
  },

  getContributionDetail: (id: string) =>
    api.get<ApiResponse>(`/api/fund/contributions/${id}/`),

  updateContribution: (id: string, data: Partial<{
    amount: number;
    currency: string;
    guest_name: string;
    payment_method: string;
    status: string;
    notes: string;
    rejection_reason: string;
    show_in_public_list: boolean;
    display_name_choice: ContributionDisplayNameChoice;
    public_display_name: string;
    message: string;
  }>) => api.patch<ApiResponse>(`/api/fund/contributions/${id}/edit/`, data),

  getMyContributions: (page = 1) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    return api.get<ApiResponse>(`/api/fund/contributions/mine/?${params.toString()}`);
  },

  getExpenses: (
    page = 1,
    filters: { search?: string; date_from?: string; date_to?: string; amount_min?: string; amount_max?: string; withdrawn_by?: string } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (filters.search) params.set('search', filters.search);
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    if (filters.amount_min) params.set('amount_min', filters.amount_min);
    if (filters.amount_max) params.set('amount_max', filters.amount_max);
    if (filters.withdrawn_by) params.set('withdrawn_by', filters.withdrawn_by);
    return api.get<ApiResponse>(`/api/fund/expenses/?${params.toString()}`);
  },

  createExpense: (data: {
    amount: number;
    short_reason: string;
    description?: string;
    receipt_image?: File;
    expense_date: string;
  }) => {
    const formData = new FormData();
    formData.append('amount', String(data.amount));
    formData.append('short_reason', data.short_reason);
    if (data.description) formData.append('description', data.description);
    if (data.receipt_image) formData.append('receipt_image', data.receipt_image);
    formData.append('expense_date', data.expense_date);
    return api.post<ApiResponse>('/api/fund/expenses/create/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteExpense: (id: string) =>
    api.delete<ApiResponse>(`/api/fund/expenses/${id}/delete/`),

  getExpenseDetail: (id: string) =>
    api.get<ApiResponse>(`/api/fund/expenses/${id}/`),

  getExpenseComments: (id: string) =>
    api.get<ApiResponse>(`/api/fund/expenses/${id}/comments/`),

  createExpenseComment: (
    id: string,
    data: { text: string; rating?: number; guest_name?: string; captcha_token: string }
  ) => api.post<ApiResponse>(`/api/fund/expenses/${id}/comments/create/`, data),
};

// ═══════════════════════════════════════════════════════════════════════════════
// Payments API
// ═══════════════════════════════════════════════════════════════════════════════
export const paymentsAPI = {
  getMethods: () => api.get<ApiResponse>('/api/payments/methods/'),

  initiate: (data: {
    amount: number;
    payment_method: string;
    guest_name?: string;
    notes?: string;
    show_in_public_list?: boolean;
    display_name_choice?: ContributionDisplayNameChoice;
    public_display_name?: string;
    message?: string;
    captcha_token: string;
  }) => api.post<ApiResponse>('/api/payments/initiate/', data),

  uploadReceipt: (contributionId: string, file: File) => {
    const formData = new FormData();
    formData.append('receipt_image', file);
    return api.post<ApiResponse>(
      `/api/payments/${contributionId}/receipt/`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  getStatus: (contributionId: string) =>
    api.get<ApiResponse>(`/api/payments/${contributionId}/status/`),
};

// ═══════════════════════════════════════════════════════════════════════════════
// Members API
// ═══════════════════════════════════════════════════════════════════════════════
export interface MemberListItem {
  id: string;
  full_name: string;
  display_name: string;
  member_number: number | null;
  group_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
}

export interface MemberDetail extends MemberListItem {
  email: string | null;
  phone: string | null;
  group_permissions: string[];
  deactivation_reason?: string;
  deactivated_by_name?: string | null;
}

export interface MemberFullProfile {
  member: MemberDetail;
  comments: CommentDetail[];
  contributions: Contribution[];
  contact_messages: ContactMessage[];
  activity_logs: ActivityLogEntry[];
}

export const membersAPI = {
  getPublicCount: () => api.get<ApiResponse>('/api/members/count/'),

  getProfile: (id: string) => api.get<ApiResponse>(`/api/members/${id}/`),

  updateProfile: (
    id: string,
    data: {
      full_name?: string;
      display_name?: string;
      email?: string;
      phone?: string;
    }
  ) => api.patch<ApiResponse>(`/api/members/${id}/update/`, data),

  changePassword: (
    id: string,
    data: {
      old_password?: string;
      new_password: string;
      confirm_new_password: string;
    }
  ) => api.post<ApiResponse>(`/api/members/${id}/change-password/`, data),

  // ── Admin ──────────────────────────────────────────────────────────────
  getList: (
    page = 1,
    filters: { search?: string; group?: string; is_active?: boolean } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (filters.search) params.set('search', filters.search);
    if (filters.group) params.set('group', filters.group);
    if (filters.is_active !== undefined) params.set('is_active', String(filters.is_active));
    return api.get<ApiResponse>(`/api/members/?${params.toString()}`);
  },

  create: (data: {
    full_name: string;
    display_name?: string;
    phone?: string;
    email?: string;
    password: string;
    password_confirm: string;
    group_id?: string;
  }) => api.post<ApiResponse>('/api/members/create/', data),

  changeGroup: (id: string, groupId: string) =>
    api.patch<ApiResponse>(`/api/members/${id}/group/`, { group_id: groupId }),

  updateMemberNumber: (id: string, memberNumber: number) =>
    api.patch<ApiResponse>(`/api/members/${id}/number/`, { member_number: memberNumber }),

  toggleActive: (id: string, reason?: string) =>
    api.patch<ApiResponse>(`/api/members/${id}/toggle-active/`, reason !== undefined ? { reason } : undefined),

  delete: (id: string) => api.delete<ApiResponse>(`/api/members/${id}/delete/`),

  getFullProfile: (id: string) => api.get<ApiResponse>(`/api/members/${id}/full-profile/`),
};

// ═══════════════════════════════════════════════════════════════════════════════
// Groups API
// ═══════════════════════════════════════════════════════════════════════════════
export interface GroupPermission {
  codename: string;
  label: string;
}

export interface AccessGroup {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  permissions: GroupPermission[];
  member_count: number;
  created_at: string;
}

export const groupsAPI = {
  getList: () => api.get<ApiResponse>('/api/groups/'),

  create: (data: { name: string; description?: string; permission_ids?: string[] }) =>
    api.post<ApiResponse>('/api/groups/create/', data),

  update: (
    id: string,
    data: { name?: string; description?: string; permission_ids?: string[] }
  ) => api.patch<ApiResponse>(`/api/groups/${id}/update/`, data),

  setDefault: (id: string) =>
    api.patch<ApiResponse>(`/api/groups/${id}/set-default/`),

  delete: (id: string) => api.delete<ApiResponse>(`/api/groups/${id}/delete/`),
};

// ═══════════════════════════════════════════════════════════════════════════════
// Permissions API
// ═══════════════════════════════════════════════════════════════════════════════
export interface Permission {
  id: string;
  codename: string;
  label: string;
  description: string;
}

export const permissionsAPI = {
  getList: () => api.get<ApiResponse>('/api/permissions/'),
};

// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard API
// ═══════════════════════════════════════════════════════════════════════════════
export interface DashboardData {
  fund: {
    balance: number;
    total_contributions: number;
    total_expenses: number;
    currency: string;
    contributions_this_month: number;
    expenses_this_month: number;
  };
  members: { total: number; active: number; inactive: number };
  recent_contributions: Contribution[];
  recent_expenses: Expense[];
  recent_posts: PostSummary[];
  pending_comments?: Comment[];
  pending_contributions_count?: number;
  pending_contact_messages_count?: number;
}

export const dashboardAPI = {
  getStats: () => api.get<ApiResponse>('/api/dashboard/'),
};

// ═══════════════════════════════════════════════════════════════════════════════
// Logs API
// ═══════════════════════════════════════════════════════════════════════════════
export interface ActivityLogEntry {
  id: string;
  actor_display: string;
  action: string;
  target_display: string;
  ip_address: string | null;
  extra_data: Record<string, unknown> | null;
  created_at: string;
}

export interface SystemLogEntry {
  id: string;
  level: string;
  source: string;
  message: string;
  extra_data: Record<string, unknown> | null;
  related_member_name: string | null;
  ip_address: string | null;
  created_at: string;
}

export const logsAPI = {
  getActivity: (
    page = 1,
    filters: { actor?: string; action?: string; date_from?: string; date_to?: string; ip_address?: string } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (filters.actor) params.set('actor', filters.actor);
    if (filters.action) params.set('action', filters.action);
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    if (filters.ip_address) params.set('ip_address', filters.ip_address);
    return api.get<ApiResponse>(`/api/logs/activity/?${params.toString()}`);
  },

  getActivityDetail: (id: string) => api.get<ApiResponse>(`/api/logs/activity/${id}/`),

  getSystem: (
    page = 1,
    filters: { level?: string; source?: string; date_from?: string; date_to?: string } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (filters.level) params.set('level', filters.level);
    if (filters.source) params.set('source', filters.source);
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    return api.get<ApiResponse>(`/api/logs/system/?${params.toString()}`);
  },

  getSystemDetail: (id: string) => api.get<ApiResponse>(`/api/logs/system/${id}/`),
};

// ═══════════════════════════════════════════════════════════════════════════════
// Settings API
// ═══════════════════════════════════════════════════════════════════════════════
export interface DefaultSettingItem {
  id: string;
  key: string;
  value: string;
  description: string;
  updated_by_name: string | null;
  updated_at: string;
}

export const settingsAPI = {
  getPublicSettings: async () => {
    try {
      return await api.get<ApiResponse>('/api/settings/public/');
    } catch {
      return null;
    }
  },

  // ── Admin (superuser) ──────────────────────────────────────────────────
  getAll: () => api.get<ApiResponse>('/api/settings/'),

  update: (key: string, value: string) =>
    api.patch<ApiResponse>(`/api/settings/${key}/`, { value }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// System Status API
// ═══════════════════════════════════════════════════════════════════════════════
export interface SystemStatus {
  database: {
    engine: string;
    connected: boolean;
  };
  debug: boolean;
  environment: 'railway' | 'local';
  media_storage: 's3' | 'local';
  django_version: string;
  counts: {
    members_total: number;
    members_active: number;
    posts: number;
    contributions: number;
    expenses: number;
    pending_comments: number;
  };
}

export const systemAPI = {
  getStatus: () => api.get<ApiResponse>('/api/settings/system-status/'),
};

// ═══════════════════════════════════════════════════════════════════════════════
// Contact API
// ═══════════════════════════════════════════════════════════════════════════════
export interface ContactMessage {
  id: string;
  // Admin lookup code; only ever shown to admins or to the sender's own "my messages" view.
  tracking_code: string;
  name: string;
  contact_info: string;
  message: string;
  sender_label: string | null;
  // Admin-only — only populated when the submitter was logged in.
  sender_member_number: number | null;
  is_handled: boolean;
  handled_by_label: string | null;
  handled_at: string | null;
  created_at: string;
}

export const contactAPI = {
  submit: (data: { name: string; contact_info: string; message: string; captcha_token: string }) =>
    api.post<ApiResponse>('/api/contact/submit/', data),

  // ── Admin ──────────────────────────────────────────────────────────────
  getList: (
    page = 1,
    filters: { is_handled?: 'true' | 'false'; search?: string; sender?: string } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (filters.is_handled) params.set('is_handled', filters.is_handled);
    if (filters.search) params.set('search', filters.search);
    if (filters.sender) params.set('sender', filters.sender);
    return api.get<ApiResponse>(`/api/contact/?${params.toString()}`);
  },

  toggleHandled: (id: string) =>
    api.patch<ApiResponse>(`/api/contact/${id}/toggle-handled/`),

  // ── Member ─────────────────────────────────────────────────────────────
  getMine: (page = 1) => api.get<ApiResponse>(`/api/contact/mine/?page=${page}`),
};

export default api;
