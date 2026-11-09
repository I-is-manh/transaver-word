/**
 * Bọc hiệu ứng theme (brand/themes/effects.js). MVP chỉ dùng bộ "basic" của theme Teal.
 * effects.js tự tôn trọng prefers-reduced-motion và data-tv-motion="off".
 */
import '@brand/themes/effects.js';

interface TVEffectsApi {
  flip(el: Element): void;
  correct(el: Element): void;
  wrong(el: Element): void;
  complete(opts: { title: string; sub?: string }): void;
  streak(days: number): void;
  announce(opts: { title: string; sub?: string }): void;
  refresh(): void;
  destroy(): void;
}

declare global {
  interface Window {
    TVEffects?: {
      create(opts: { container: Element; set: string; motion?: boolean }): TVEffectsApi;
    };
  }
}

let instance: TVEffectsApi | null = null;

export function effects(): TVEffectsApi | null {
  if (instance) return instance;
  if (!window.TVEffects) return null;
  instance = window.TVEffects.create({ container: document.body, set: 'basic' });
  return instance;
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
