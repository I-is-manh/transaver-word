const squash = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s.,;:!?…"'“”‘’)\]]+$/u, '');

/** Câu chỉ là chính từ đó (vd. lưu tiêu đề "First steps") → không cần hiện lại. */
export function sentenceIsWord(sentence: string, text: string): boolean {
  return squash(sentence) === squash(text);
}
