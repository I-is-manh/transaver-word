/** Định dạng số giây thành "1 phút", "6 giờ", "3 ngày", "2 tháng". */
export function formatInterval(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} phút`;
  if (s < 86400) return `${Math.round(s / 3600)} giờ`;
  const days = Math.round(s / 86400);
  if (days < 30) return `${days} ngày`;
  if (days < 365) return `${Math.round(days / 30)} tháng`;
  return `${(days / 365).toFixed(1).replace(/\.0$/, '').replace('.', ',')} năm`;
}

const dateFmt = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const dateTimeFmt = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDate = (iso: string | null | undefined) =>
  iso ? dateFmt.format(new Date(iso)) : '';
export const formatDateTime = (iso: string | null | undefined) =>
  iso ? dateTimeFmt.format(new Date(iso)) : '';

/** "YYYY-MM-DD" → "08/11" hoặc "08/11/2026". */
export function formatDay(day: string, withYear = false): string {
  const [y, m, d] = day.split('-');
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}

/** Khi nào đến hạn ôn, nói theo kiểu người: "hôm nay", "sau 3 ngày", "đã quá hạn". */
export function formatDue(iso: string | null): string {
  if (!iso) return 'Chưa ôn';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Cần ôn hôm nay';
  return `Ôn lại sau ${formatInterval(diff / 1000)}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n);
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} giây`;
  return s ? `${m} phút ${s} giây` : `${m} phút`;
}

export const POS_VI: Record<string, string> = {
  noun: 'danh từ',
  verb: 'động từ',
  adjective: 'tính từ',
  adverb: 'trạng từ',
  pronoun: 'đại từ',
  preposition: 'giới từ',
  conjunction: 'liên từ',
  interjection: 'thán từ',
  phrase: 'cụm từ',
};

export const posLabel = (pos: string | null) => (pos ? (POS_VI[pos] ?? pos) : '');
