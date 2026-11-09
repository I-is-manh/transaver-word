/** Màu gợi ý cho deck lấy từ token của theme đang dùng (không viết mã màu cố định). */
const TOKENS = [
  '--brand',
  '--accent',
  '--info',
  '--accent-strong',
  '--brand-strong',
  '--line-strong',
];

function toHex(color: string): string | null {
  const c = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toUpperCase();
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(c);
  if (!m) return null;
  return (
    '#' +
    [m[1], m[2], m[3]]
      .map((v) => Number(v).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function deckSwatches(): string[] {
  const cs = getComputedStyle(document.documentElement);
  return [
    ...new Set(TOKENS.map((t) => toHex(cs.getPropertyValue(t))).filter((v): v is string => !!v)),
  ];
}
