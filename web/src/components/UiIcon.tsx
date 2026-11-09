/**
 * Icon thao tác dạng SVG nét (1.75, currentColor), cùng kiểu ArrowIcon. brand/icons không có bút chì,
 * thùng rác… nên vẽ ở đây. Đặt trong phần tử inline-flex (align-items: center) để thẳng hàng với chữ.
 */
export type UiIconName =
  'pencil' | 'trash' | 'check' | 'rotate-ccw' | 'x' | 'chevron-down' | 'chevron-right';

const PATHS: Record<UiIconName, string[]> = {
  pencil: ['M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z', 'M14.5 5.5l3 3'],
  trash: [
    'M4 6.5h16',
    'M9 6.5V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
    'M6 6.5l.9 12.6a1.5 1.5 0 0 0 1.5 1.4h7.2a1.5 1.5 0 0 0 1.5-1.4L18 6.5',
    'M10 10.5v6',
    'M14 10.5v6',
  ],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  'rotate-ccw': ['M4 12a8 8 0 1 0 2.35-5.65L4 8.5', 'M4 4v4.5h4.5'],
  x: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'],
  'chevron-down': ['M6 9.5l6 6 6-6'],
  'chevron-right': ['M9.5 6l6 6-6 6'],
};

export function UiIcon({ name, size = 18 }: { name: UiIconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block', flex: 'none' }}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
