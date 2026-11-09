import { effects } from '@/lib/effects';

export type Outcome = { correct: boolean; answer: string | null };

/** So khớp kiểu bài gõ: không phân biệt hoa thường, bỏ khoảng trắng hai đầu (mục 5.1). */
export function sameAnswer(a: string, b: string | null): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return b !== null && norm(a) === norm(b);
}

export function playFeedback(el: Element | null, correct: boolean) {
  if (!el) return;
  const fx = effects();
  if (correct) fx?.correct(el);
  else fx?.wrong(el);
}
