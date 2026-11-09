/** Khóa TanStack Query dùng chung để invalidate đúng chỗ. */
export const qk = {
  words: ['words'] as const,
  word: (id: number) => ['words', 'detail', id] as const,
  trash: ['words', 'trash'] as const,
  decks: ['decks'] as const,
  settings: ['settings'] as const,
  summary: ['stats', 'summary'] as const,
  stats: ['stats'] as const,
  achievements: ['stats', 'achievements'] as const,
};
