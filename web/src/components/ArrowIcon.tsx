/**
 * Mũi tên trái/phải dạng SVG. Dùng thay cho ký tự ← →: font Be Vietnam Pro không có hai ký tự này nên
 * trình duyệt lấy font khác, mũi tên bị lệch xuống dưới dòng chữ. Đặt trong phần tử inline-flex
 * (align-items: center) để luôn thẳng hàng với chữ. Màu theo currentColor.
 */
export function ArrowIcon({ dir, size = 16 }: { dir: 'left' | 'right'; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block', flex: 'none' }}
    >
      {dir === 'left' ? (
        <path d="M13 8H3M7.5 3.5L3 8l4.5 4.5" />
      ) : (
        <path d="M3 8h10M8.5 3.5L13 8l-4.5 4.5" />
      )}
    </svg>
  );
}
