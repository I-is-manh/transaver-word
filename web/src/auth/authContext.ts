import { createContext, useContext } from 'react';
import type { LoginRequest, RegisterRequest, User } from '@/api/types';

export type AuthStatus = 'loading' | 'authenticated' | 'guest';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (body: Omit<LoginRequest, 'device_name'>) => Promise<User>;
  register: (body: Omit<RegisterRequest, 'device_name' | 'timezone'>) => Promise<User>;
  logout: () => Promise<void>;
  /** Đổi mã một lần từ Google lấy phiên đăng nhập (mục 2.6). Trả thêm created = tài khoản mới */
  loginWithGoogleCode: (code: string) => Promise<{ user: User; created: boolean }>;
  /** Superadmin: đăng nhập với tư cách user khác (mục 9.1) */
  impersonate: (userId: number) => Promise<User>;
  /** Quay lại tài khoản superadmin */
  stopImpersonation: () => Promise<void>;
  /** true khi đang dùng token impersonate */
  impersonating: boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải dùng bên trong <AuthProvider>.');
  return ctx;
}
