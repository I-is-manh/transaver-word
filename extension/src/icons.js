/**
 * Bộ icon thương hiệu Transaver Word (lưới 24px, nét 1.75, bo tròn) — xem brand/icons/.
 * Dựng bằng createElementNS (không dùng innerHTML) để chạy được trên trang bật Trusted Types.
 * Icon dùng stroke="currentColor" nên tự theo màu chữ của nút chứa nó.
 */
(function (root) {
  const NS = 'http://www.w3.org/2000/svg';

  // Mỗi icon là danh sách [tag, thuộc tính].
  const ICONS = {
    translate: [
      ['path', { d: 'M3 19 7.5 6 12 19M4.8 14.5h5.4' }],
      ['path', { d: 'M14 8.5h7M17.5 6.5v2M15 8.5c.6 3.4 2.6 6.3 6 8.5M20.2 8.5c-.6 3.4-2.6 6.3-6 8.5' }],
    ],
    swap: [['path', { d: 'M4 8h15M15.5 4.5 19 8l-3.5 3.5M20 16H5M8.5 12.5 5 16l3.5 3.5' }]],
    close: [['path', { d: 'm6 6 12 12M18 6 6 18' }]],
    audio: [
      ['path', { d: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4Z' }],
      ['path', { d: 'M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11' }],
    ],
    copy: [
      ['rect', { x: '8.5', y: '8.5', width: '11', height: '11', rx: '2' }],
      ['path', { d: 'M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5' }],
    ],
    check: [['path', { d: 'm5 12.5 5 5L19 7' }]],
    save: [['path', { d: 'M7 3.5h10A1.5 1.5 0 0 1 18.5 5v15.5L12 16l-6.5 4.5V5A1.5 1.5 0 0 1 7 3.5Z' }]],
  };

  /** Tạo phần tử <svg> cho icon `name`, kích thước `size` px. */
  function icon(name, size = 18) {
    const svg = document.createElementNS(NS, 'svg');
    const attrs = {
      viewBox: '0 0 24 24',
      width: String(size),
      height: String(size),
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.75',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    };
    for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
    for (const [tag, a] of ICONS[name] || []) {
      const el = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(a)) el.setAttribute(k, v);
      svg.appendChild(el);
    }
    return svg;
  }

  root.TV = root.TV || {};
  root.TV.icon = icon;
})(globalThis);
