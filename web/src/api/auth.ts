import { API_BASE_URL, apiRequest } from './client';
import type {
  AuthResponse,
  GoogleExchangeResponse,
  LoginRequest,
  RegisterRequest,
  User,
} from './types';

export const authApi = {
  register: (body: RegisterRequest) =>
    apiRequest<AuthResponse>('/auth/register', { method: 'POST', body }),
  login: (body: LoginRequest) => apiRequest<AuthResponse>('/auth/login', { method: 'POST', body }),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
  me: (signal?: AbortSignal) => apiRequest<{ user: User }>('/me', { signal }),
  /** Mục 2.7: gửi lại email xác nhận (202), đã xác nhận rồi (200, sent=false), quá nhanh (429) */
  resendVerification: () =>
    apiRequest<{ message: string; sent: boolean }>('/email/verification-notification', {
      method: 'POST',
    }),
  googleExchange: (body: { code: string; timezone?: string; device_name: 'web' }) =>
    apiRequest<GoogleExchangeResponse>('/auth/google/exchange', { method: 'POST', body }),
};

/**
 * Địa chỉ bắt đầu đăng nhập Google (mục 2.6). Backend chuyển sang Google rồi quay về
 * /auth/google/callback của web. Chế độ mock: nhảy thẳng tới callback với mã giả.
 */
export function googleLoginUrl(): string {
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    return `/auth/google/callback?code=${'m'.repeat(64)}`;
  }
  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${origin}/auth/google/redirect`;
}

/** Múi giờ IANA của trình duyệt, gửi kèm khi đăng ký. */
export function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
