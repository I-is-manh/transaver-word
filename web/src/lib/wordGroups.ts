import type { WordGroup, WordGroupBy } from '@/api/types';

/** Cách nhóm trên /words; 'none' = danh sách cũ có phân trang. */
export type WordGrouping = WordGroupBy | 'none';

export const GROUPINGS: { value: WordGrouping; label: string }[] = [
  { value: 'day', label: 'Ngày' },
  { value: 'month', label: 'Tháng' },
  { value: 'year', label: 'Năm' },
  { value: 'none', label: 'Không nhóm' },
];

export const isGrouping = (v: unknown): v is WordGrouping =>
  v === 'day' || v === 'month' || v === 'year' || v === 'none';

// ---------------------------------------------------------------- nhớ lựa chọn

const VIEW_KEY = 'tv.words.view';

export interface WordsView {
  lang?: string;
  group?: WordGrouping;
}

export function readWordsView(): WordsView {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    const v = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    return {
      lang: typeof v.lang === 'string' && v.lang ? v.lang : undefined,
      group: isGrouping(v.group) ? v.group : undefined,
    };
  } catch {
    return {};
  }
}

export function saveWordsView(v: WordsView): void {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(v));
  } catch {
    // bỏ qua (chế độ riêng tư…)
  }
}

// ---------------------------------------------------------------- tên ngôn ngữ

let displayNames: Intl.DisplayNames | null | undefined;
function languageName(code: string): string {
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames('vi', { type: 'language' });
    } catch {
      displayNames = null;
    }
  }
  try {
    const name = displayNames?.of(code);
    if (name && name.toLowerCase() !== code.toLowerCase())
      return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    // mã không hợp lệ
  }
  return code.toUpperCase();
}

/**
 * Tên tiếng Việt cho từng mã ngôn ngữ. Biến thể có vùng ("zh-cn" → "Tiếng Trung (Trung Quốc)") được
 * rút gọn còn tên ngôn ngữ gốc nếu trong danh sách chỉ có một biến thể của ngôn ngữ đó.
 */
export function languageLabels(codes: string[]): Map<string, string> {
  const base = (c: string) => c.toLowerCase().split(/[-_]/)[0]!;
  const perBase = new Map<string, number>();
  for (const c of codes) perBase.set(base(c), (perBase.get(base(c)) ?? 0) + 1);
  return new Map(
    codes.map((c) => [c, perBase.get(base(c)) === 1 ? languageName(base(c)) : languageName(c)]),
  );
}

// ---------------------------------------------------------------- nhóm thời gian

/** Ngày hôm nay YYYY-MM-DD theo múi giờ người dùng. */
export function todayIn(timeZone: string | undefined, d = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-CA').format(d);
  }
}

function shiftDay(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const weekday = new Intl.DateTimeFormat('vi', { weekday: 'long', timeZone: 'UTC' });

/** Khóa nhóm của một saved_date (YYYY-MM-DD). */
export function groupKeyOf(savedDate: string, by: WordGroupBy): string {
  return by === 'day' ? savedDate : by === 'month' ? savedDate.slice(0, 7) : savedDate.slice(0, 4);
}

/** "Hôm nay", "Hôm qua", "Thứ Sáu · 06/11/2026" · "Tháng 11/2026" · "Năm 2026". */
export function groupTitle(group: WordGroup, by: WordGroupBy, today: string): string {
  if (by === 'year') return `Năm ${group.key}`;
  if (by === 'month') {
    const [y, m] = group.key.split('-');
    return `Tháng ${Number(m)}/${y}`;
  }
  if (group.key === today) return 'Hôm nay';
  if (group.key === shiftDay(today, -1)) return 'Hôm qua';
  const [y, m, d] = group.key.split('-').map(Number) as [number, number, number];
  const name = weekday.format(new Date(Date.UTC(y, m - 1, d)));
  const day = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  return `${name.charAt(0).toUpperCase() + name.slice(1)} · ${day}`;
}
