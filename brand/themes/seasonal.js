/* Bản mẫu logic chọn theme đang áp dụng (theme theo dịp tự bật cho toàn hệ thống).
   Backend (Laravel) phải cài đúng logic này và trả kết quả cho cả web app lẫn extension,
   để hai bên luôn hiện cùng một theme. Xem docs/theme-system.md mục 7.

   resolveActiveTheme({
     chosen: 'autumn',                 // theme người dùng đã chọn (đã mở khóa)
     seasonalEnabled: true,            // cài đặt "Tự đổi theme theo dịp" (mặc định bật)
     date: '2026-10-30',               // ngày hôm nay THEO MÚI GIỜ CỦA NGƯỜI DÙNG, dạng YYYY-MM-DD
     seasons: window.TV_SEASONS,       // từ themes.json → seasons.events
   })
   → { theme: 'halloween', reason: 'season', event: {...}, endsOn: '2026-11-01' }
   hoặc { theme: 'autumn', reason: 'chosen' } */
(function (global) {
  'use strict';

  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

  /** Khoảng ngày [start, end] của một dịp trong một năm (gồm cả hai đầu), hoặc null nếu thiếu dữ liệu. */
  function windowFor(event, year) {
    if (event.rule === 'fixed') {
      return { start: parse(`${year}-${event.start}`), end: parse(`${year}-${event.end}`) };
    }
    const anchor = event.anchor_dates && event.anchor_dates[String(year)];
    if (!anchor) return null;
    const a = parse(anchor);
    return { start: addDays(a, -event.days_before), end: addDays(a, event.days_after) };
  }

  /** Dịp đang diễn ra vào ngày `date` (YYYY-MM-DD), hoặc null. */
  function activeSeason(date, seasons) {
    const d = parse(date);
    const y = d.getUTCFullYear();
    for (const e of seasons || []) {
      // Xét cả năm trước và năm sau để bắt các dịp vắt qua năm mới
      for (const year of [y - 1, y, y + 1]) {
        const w = windowFor(e, year);
        if (w && d >= w.start && d <= w.end) return { event: e, start: iso(w.start), end: iso(w.end) };
      }
    }
    return null;
  }

  function resolveActiveTheme({ chosen, seasonalEnabled = true, date, seasons }) {
    if (seasonalEnabled) {
      const s = activeSeason(date, seasons);
      if (s) return { theme: s.event.theme, reason: 'season', event: s.event, startsOn: s.start, endsOn: s.end };
    }
    return { theme: chosen || 'teal', reason: 'chosen' };
  }

  /** Dịp sắp tới (để hiện "Sắp có theme Halloween từ 25/10"). */
  function nextSeason(date, seasons) {
    const d = parse(date);
    let best = null;
    for (const e of seasons || []) {
      for (const year of [d.getUTCFullYear(), d.getUTCFullYear() + 1]) {
        const w = windowFor(e, year);
        if (w && w.start > d && (!best || w.start < best.start)) best = { event: e, start: w.start, end: w.end };
      }
    }
    return best && { event: best.event, startsOn: iso(best.start), endsOn: iso(best.end) };
  }

  global.TVSeasonal = { resolveActiveTheme, activeSeason, nextSeason, windowFor };
})(typeof window !== 'undefined' ? window : globalThis);
