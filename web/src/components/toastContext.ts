import { createContext, useContext, type ReactNode } from 'react';

export interface ToastOptions {
  message: ReactNode;
  title?: string;
  tone?: 'info' | 'success' | 'error' | 'reward';
  icon?: ReactNode;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

export const ToastContext = createContext<{
  show: (opts: ToastOptions) => number;
  dismiss: (id: number) => void;
} | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast phải dùng bên trong <ToastProvider>.');
  return ctx;
}
