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
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
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
let pendingRequests: Array<(token: string) => void> = [];

function onRefreshed(token: string) {
  pendingRequests.forEach((cb) => cb(token));
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
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const store = getAuthStore();
      const { refreshToken, setTokens, logout } = store.getState();

      if (!refreshToken) {
        logout();
        if (typeof window !== 'undefined') {
          window.location.href = `${prefix}/login`;
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until the refresh resolves
        return new Promise((resolve) => {
          pendingRequests.push((newToken: string) => {
            if (originalRequest.headers) {
              (originalRequest.headers as Record<string, string>)[
                'Authorization'
              ] = `Bearer ${newToken}`;
            } else {
              originalRequest.headers = { Authorization: `Bearer ${newToken}` };
            }
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/token/refresh/`,
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
      } catch {
        isRefreshing = false;
        pendingRequests = [];
        const store2 = getAuthStore();
        store2.getState().logout();
        if (typeof window !== 'undefined') {
          window.location.href = `${prefix}/login`;
        }
        return Promise.reject(error);
      }
    }

    // ── 403: forbidden ──────────────────────────────────────────────────────
    if (status === 403) {
      if (typeof window !== 'undefined') {
        window.location.href = `${prefix}/forbidden`;
      }
      return Promise.reject(error);
    }

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
  }) => api.post<ApiResponse>('/api/auth/register/', data),

  login: (credential: string, password: string) =>
    api.post<ApiResponse>('/api/auth/login/', { credential, password }),

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
  id: number;
  image: string;
  thumbnail?: string;
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

export interface Comment {
  id: number;
  author_label?: string;
  guest_name?: string | null;
  text: string;
  rating: number | null;
  is_approved: boolean;
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
  getList: (page = 1, search = '') => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (search) params.set('search', search);
    return api.get<ApiResponse>(`/api/posts/?${params.toString()}`);
  },

  getDetail: (id: string) => api.get<ApiResponse>(`/api/posts/${id}/`),

  getComments: (id: string) =>
    api.get<ApiResponse>(`/api/posts/${id}/comments/`),

  createComment: (
    id: string,
    data: { text: string; rating?: number; guest_name?: string }
  ) => api.post<ApiResponse>(`/api/posts/${id}/comments/create/`, data),
};

// ─── Fund types ───────────────────────────────────────────────────────────────
export interface FundBalance {
  total_contributions: number;
  total_expenses: number;
  balance: number;
  currency: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fund API
// ═══════════════════════════════════════════════════════════════════════════════
export const fundAPI = {
  getBalance: () => api.get<ApiResponse>('/api/fund/balance/'),

  getContributions: (page = 1) =>
    api.get<ApiResponse>(`/api/fund/contributions/?page=${page}`),

  getExpenses: (page = 1) =>
    api.get<ApiResponse>(`/api/fund/expenses/?page=${page}`),
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
export const membersAPI = {
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
};

// ═══════════════════════════════════════════════════════════════════════════════
// Settings API
// ═══════════════════════════════════════════════════════════════════════════════
export const settingsAPI = {
  // Bypasses the shared `api` instance — its interceptor force-redirects on
  // 403, but regular visitors hitting this superuser-only endpoint must be
  // able to fail silently so the public contact page keeps rendering.
  getPublicSettings: async () => {
    try {
      const response = await axios.get<ApiResponse>(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/settings/`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      return unwrapApiResponse(response);
    } catch {
      return null;
    }
  },
};

export default api;
