import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/api/endpoints';
import type { Appearance, Settings } from '@/api/types';
import { useAuth } from '@/auth/authContext';
import { applyAppearance, isAppearance, readAppearance, systemPrefersDark } from '@/lib/appearance';
import { qk } from '@/lib/queryKeys';
import { AppearanceContext } from './appearanceContext';
import { useToast } from './toastContext';

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { status, impersonating } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [appearance, setState] = useState<Appearance>(() => readAppearance());
  const [osDark, setOsDark] = useState(systemPrefersDark);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setOsDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // Giá trị server ghi đè local khi tải settings (không áp khi đang xem với tư cách người khác)
  const canSync = status === 'authenticated' && !impersonating;
  const settings = useQuery({
    queryKey: qk.settings,
    queryFn: () => settingsApi.get().then((r) => r.settings),
    enabled: canSync,
    staleTime: 60_000,
  });
  const lastServer = useRef<Appearance | null>(null);
  // Thời điểm người dùng đổi trên máy này: dữ liệu server tải về trước đó là cũ, không được ghi đè
  const localChangedAt = useRef(0);
  useEffect(() => {
    if (!canSync) {
      lastServer.current = null;
      return;
    }
    const v = settings.data?.appearance;
    if (!isAppearance(v) || v === lastServer.current) return;
    if (settings.dataUpdatedAt < localChangedAt.current) return;
    lastServer.current = v;
    applyAppearance(v);
    setState(v);
  }, [canSync, settings.data, settings.dataUpdatedAt]);

  const setAppearance = useCallback(
    (v: Appearance) => {
      applyAppearance(v);
      setState(v);
      localChangedAt.current = Date.now();
      if (!canSync) return; // chưa đăng nhập hoặc đang impersonate: chỉ lưu local
      lastServer.current = v;
      settingsApi
        .update({ appearance: v })
        .then(({ settings: s }) => qc.setQueryData<Settings>(qk.settings, s))
        .catch(() =>
          toast.show({
            tone: 'error',
            message: 'Chưa lưu được giao diện lên tài khoản. Sẽ áp dụng trên máy này.',
          }),
        );
    },
    [canSync, qc, toast],
  );

  const value = useMemo(
    () => ({
      appearance,
      mode: (appearance === 'system' ? (osDark ? 'dark' : 'light') : appearance) as
        'light' | 'dark',
      setAppearance,
    }),
    [appearance, osDark, setAppearance],
  );
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
