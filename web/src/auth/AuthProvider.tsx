import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, browserTimezone } from '@/api/auth';
import { UNAUTHORIZED_EVENT } from '@/api/client';
import { adminApi, impersonationApi } from '@/api/endpoints';
import type { AuthResponse, User } from '@/api/types';
import { useToast } from '@/components/toastContext';
import { AuthContext, type AuthContextValue } from './authContext';
import {
  clearOriginalToken,
  clearToken,
  readOriginalToken,
  readToken,
  writeOriginalToken,
  writeToken,
} from './tokenStorage';

export const ME_QUERY_KEY = ['me'] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [token, setToken] = useState<string | null>(() => readToken());

  const meQuery = useQuery({
    queryKey: [...ME_QUERY_KEY, token],
    queryFn: ({ signal }) => authApi.me(signal).then((r) => r.user),
    enabled: token !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const signOutLocally = useCallback(() => {
    clearToken();
    clearOriginalToken();
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  /** Bỏ token impersonate, dùng lại token gốc của superadmin. */
  const restoreOriginal = useCallback((): boolean => {
    const original = readOriginalToken();
    if (!original) return false;
    clearOriginalToken();
    writeToken(original);
    queryClient.clear();
    setToken(original);
    return true;
  }, [queryClient]);

  // 401 (hoặc 403 khóa tài khoản): đang impersonate thì quay về token gốc, ngược lại đăng xuất.
  useEffect(() => {
    const onUnauthorized = (e: Event) => {
      if (restoreOriginal()) {
        toast.show({
          tone: 'info',
          message: 'Phiên xem với tư cách người khác đã hết hạn. Đã quay lại tài khoản của bạn.',
        });
        return;
      }
      const reason = (e as CustomEvent<string | null>).detail;
      if (reason) toast.show({ tone: 'error', message: reason });
      signOutLocally();
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [signOutLocally, restoreOriginal, toast]);

  const acceptSession = useCallback(
    ({ token: newToken, user }: { token: string; user: User }): User => {
      writeToken(newToken);
      queryClient.setQueryData([...ME_QUERY_KEY, newToken], user);
      setToken(newToken);
      return user;
    },
    [queryClient],
  );

  const login = useCallback<AuthContextValue['login']>(
    async (body) => {
      const res: AuthResponse = await authApi.login({ ...body, device_name: 'web' });
      clearOriginalToken();
      return acceptSession(res);
    },
    [acceptSession],
  );

  const register = useCallback<AuthContextValue['register']>(
    async (body) => {
      const res = await authApi.register({
        ...body,
        timezone: browserTimezone(),
        device_name: 'web',
      });
      clearOriginalToken();
      return acceptSession(res);
    },
    [acceptSession],
  );

  const loginWithGoogleCode = useCallback<AuthContextValue['loginWithGoogleCode']>(
    async (code) => {
      const res = await authApi.googleExchange({
        code,
        timezone: browserTimezone(),
        device_name: 'web',
      });
      clearOriginalToken();
      return { user: acceptSession(res), created: res.created };
    },
    [acceptSession],
  );

  const impersonate = useCallback<AuthContextValue['impersonate']>(
    async (userId) => {
      const current = readToken();
      const res = await adminApi.impersonate(userId);
      if (current && !readOriginalToken()) writeOriginalToken(current);
      queryClient.clear();
      return acceptSession(res);
    },
    [acceptSession, queryClient],
  );

  const stopImpersonation = useCallback(async () => {
    try {
      await impersonationApi.stop();
    } catch {
      // Token impersonate đã hết hạn hoặc mất mạng: vẫn quay về tài khoản gốc
    }
    if (!restoreOriginal()) signOutLocally();
  }, [restoreOriginal, signOutLocally]);

  const logout = useCallback(async () => {
    // Đang impersonate: "đăng xuất" nghĩa là quay lại tài khoản gốc (logout bị chặn ở server)
    if (readOriginalToken()) return stopImpersonation();
    try {
      await authApi.logout();
    } catch {
      // Token đã hỏng hoặc mất mạng: vẫn đăng xuất ở máy này.
    } finally {
      signOutLocally();
    }
  }, [signOutLocally, stopImpersonation]);

  const value = useMemo<AuthContextValue>(() => {
    let status: AuthContextValue['status'] = 'guest';
    if (token !== null) {
      if (meQuery.data) status = 'authenticated';
      else if (meQuery.isError) status = 'guest';
      else status = 'loading';
    }
    const user = status === 'authenticated' ? (meQuery.data ?? null) : null;
    return {
      status,
      user,
      login,
      register,
      logout,
      loginWithGoogleCode,
      impersonate,
      stopImpersonation,
      impersonating: !!user?.impersonator,
    };
  }, [
    token,
    meQuery.data,
    meQuery.isError,
    login,
    register,
    logout,
    loginWithGoogleCode,
    impersonate,
    stopImpersonation,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
