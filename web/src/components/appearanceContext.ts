import { createContext, useContext } from 'react';
import type { Appearance } from '@/api/types';

export interface AppearanceContextValue {
  appearance: Appearance;
  /** Chế độ thực tế đang hiển thị */
  mode: 'light' | 'dark';
  setAppearance: (v: Appearance) => void;
}

export const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error('useAppearance phải dùng bên trong <AppearanceProvider>.');
  return ctx;
}
