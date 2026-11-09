/**
 * Giao diện sáng/tối (contract mục 6.4).
 * system → không đặt data-tv-mode (theo hệ điều hành); light/dark → data-tv-mode trên <html>.
 * Script trong index.html làm việc tương tự trước khi React render để không nháy màu.
 */
import type { Appearance } from '@/api/types';

export const APPEARANCE_KEY = 'tv.appearance';
export const APPEARANCE_EVENT = 'tv:appearance-changed';

export function isAppearance(v: unknown): v is Appearance {
  return v === 'system' || v === 'light' || v === 'dark';
}

export function readAppearance(): Appearance {
  try {
    const v = localStorage.getItem(APPEARANCE_KEY);
    return isAppearance(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyAppearance(v: Appearance): void {
  const root = document.documentElement;
  if (v === 'system') root.removeAttribute('data-tv-mode');
  else root.setAttribute('data-tv-mode', v);
  try {
    localStorage.setItem(APPEARANCE_KEY, v);
  } catch {
    // bỏ qua
  }
  // Báo cho extension (web-bridge.js)
  window.dispatchEvent(new Event(APPEARANCE_EVENT));
}

export const systemPrefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
