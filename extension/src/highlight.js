/**
 * Gạch chân từ đã lưu khi lướt web (docs/api-contract.md mục 8.4).
 *
 * - Danh sách từ do background tải về chrome.storage.local['tvHighlight'] (content script không gọi API).
 * - Dùng CSS Custom Highlight API nên KHÔNG sửa DOM của trang (không chèn thẻ span).
 * - Chỉ khi DỪNG chuột trên từ (~0,4 giây) mới hiện thẻ nhỏ: từ + nút "Hiện nghĩa" (tự kiểm tra, không hiện nghĩa ngay).
 *   Thẻ đứng yên tới khi bấm × (hoặc Esc / bấm ra ngoài thẻ); lướt chuột qua khi đọc thì không hiện.
 * - Bỏ qua ô nhập, contenteditable, <code>, <pre>, script/style, chính khung dịch của extension
 *   và toàn bộ web app Transaver (trang có <meta name="transaver-web-app">).
 * - Quét tối đa 5.000 nút văn bản mỗi trang.
 */
(() => {
  if (window.__transaverHighlightLoaded) return;
  window.__transaverHighlightLoaded = true;
  if (!globalThis.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
  // Không gạch chân trên chính web app Transaver (danh sách từ đã hiển thị ở đó)
  if (document.querySelector('meta[name="transaver-web-app"]')) return;

  const TV = globalThis.TV;
  const HL_KEY = 'tvHighlight';
  const HL_NAME = 'transaver-saved';
  const MAX_NODES = 5000;
  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE', 'KBD',
    'SAMP', 'SVG', 'MATH', 'CANVAS', 'IFRAME', 'TRANSAVER-WORD', 'TRANSAVER-WORD-HL',
  ]);

  let enabled = true;
  let words = [];
  let regex = null;
  let byText = new Map(); // normalized → word
  /** @type {{ range: Range, word: object }[]} */
  let matches = [];
  const nodeMatches = new WeakMap(); // Text → [{ start, end, word, range }]

  // Màu accent của theme Teal (themes.css): gạch chân nhẹ, không đổi màu chữ của trang.
  const style = document.createElement('style');
  style.id = 'transaver-word-highlight';
  // Màu gạch chân theo lựa chọn sáng/tối (contract mục 6.4): system → theo hệ điều hành
  function highlightCss(appearance) {
    const base = `::highlight(${HL_NAME}) { text-decoration: underline 2px #F2A516; text-underline-offset: 3px; }`;
    const dark = `::highlight(${HL_NAME}) { text-decoration-color: #F7B73A; }`;
    if (appearance === 'light') return base;
    if (appearance === 'dark') return base + dark;
    return `${base} @media (prefers-color-scheme: dark) { ${dark} }`;
  }
  style.textContent = highlightCss('system');
  TV.appearance.get().then((v) => (style.textContent = highlightCss(v)));
  TV.appearance.watch((v) => {
    style.textContent = highlightCss(v);
    if (card) TV.appearance.apply(card.host, v);
  });

  // ---------- dữ liệu ----------

  async function load() {
    const [settings, stored] = await Promise.all([
      TV.getSettings(),
      chrome.storage.local.get(HL_KEY),
    ]);
    enabled = settings.highlight !== false;
    words = (stored[HL_KEY] && stored[HL_KEY].words) || [];
    buildRegex();
    scan();
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function buildRegex() {
    byText = new Map();
    for (const w of words) {
      const key = String(w.normalized_text || w.text || '').toLowerCase().trim();
      if (key.length >= 2) byText.set(key, w);
    }
    if (!byText.size) {
      regex = null;
      return;
    }
    // Từ dài trước để cụm từ thắng từ đơn; khoảng trắng trong cụm khớp mọi khoảng trắng
    const parts = [...byText.keys()]
      .sort((a, b) => b.length - a.length)
      .map((k) => escapeRe(k).replace(/\s+/g, '\\s+'));
    regex = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${parts.join('|')})(?![\\p{L}\\p{N}_])`, 'giu');
  }

  // ---------- quét trang ----------

  function shouldSkip(el) {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (SKIP_TAGS.has(e.tagName)) return true;
      if (e.isContentEditable) return true;
      if (e.getAttribute && e.getAttribute('aria-hidden') === 'true') return true;
    }
    return false;
  }

  function scan() {
    CSS.highlights.delete(HL_NAME);
    matches = [];
    if (!enabled || !regex || !document.body) return;
    if (!style.isConnected) (document.head || document.documentElement).appendChild(style);

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.data || node.data.trim().length < 2) return NodeFilter.FILTER_REJECT;
        return shouldSkip(node.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    const ranges = [];
    let count = 0;
    for (let node = walker.nextNode(); node && count < MAX_NODES; node = walker.nextNode()) {
      count++;
      regex.lastIndex = 0;
      const list = [];
      let m;
      while ((m = regex.exec(node.data))) {
        const key = m[0].toLowerCase().replace(/\s+/g, ' ');
        const word = byText.get(key);
        if (!word) continue;
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        ranges.push(range);
        const item = { start: m.index, end: m.index + m[0].length, word, range };
        list.push(item);
        matches.push(item);
      }
      if (list.length) nodeMatches.set(node, list);
    }
    if (ranges.length) CSS.highlights.set(HL_NAME, new Highlight(...ranges));
  }

  let scanTimer = 0;
  function scheduleScan(delay = 1200) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, delay);
  }

  const observer = new MutationObserver((records) => {
    if (!enabled || !regex) return;
    // Bỏ qua thay đổi do chính extension (khung dịch, thẻ gợi ý)
    if (records.every((r) => r.target.closest && r.target.closest('transaver-word, transaver-word-hl'))) return;
    scheduleScan();
  });

  // ---------- thẻ "Bạn còn nhớ nghĩa?" ----------

  let card = null;
  let current = null; // match đang hiện thẻ
  let showTimer = 0;
  let pending = null; // match đang chờ đủ thời gian dừng chuột
  const SHOW_DELAY = 400; // dừng chuột trên từ bao lâu thì mới hiện thẻ

  function ensureCard() {
    if (card) return card;
    const host = document.createElement('transaver-word-hl');
    host.style.cssText = 'all: initial; position: absolute; top: 0; left: 0; z-index: 2147483646;';
    const shadow = host.attachShadow({ mode: 'closed' });
    const css = document.createElement('style');
    css.textContent = `
      :host { all: initial;
        --brand: #0F6E66; --brand-strong: #0B5650; --brand-tint: #E3F3F0; --on-brand: #FFFFFF;
        --ink: #14201F; --ink-muted: #56645F; --surface-1: #FFFFFF; --line: #D9E2DF; --accent: #F2A516;
        --font-body: "TW Body", "Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", sans-serif; }
      @media (prefers-color-scheme: dark) { :host(:not([data-tv-mode="light"])) {
        --brand: #3CC4B4; --brand-strong: #6BD9CB; --brand-tint: #12302D; --on-brand: #0E1514;
        --ink: #E8EFEE; --ink-muted: #9AAAA6; --surface-1: #162120; --line: #2A3836; --accent: #F7B73A; } }
      :host([data-tv-mode="dark"]) {
        --brand: #3CC4B4; --brand-strong: #6BD9CB; --brand-tint: #12302D; --on-brand: #0E1514;
        --ink: #E8EFEE; --ink-muted: #9AAAA6; --surface-1: #162120; --line: #2A3836; --accent: #F7B73A; }
      [hidden] { display: none !important; }
      .card { position: absolute; width: 240px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px;
        font: 400 13px/18px var(--font-body); color: var(--ink); background: var(--surface-1);
        border: 1px solid var(--line); border-top: 3px solid var(--accent); border-radius: 10px;
        box-shadow: 0 10px 28px rgba(0,0,0,.18); }
      .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .word { font-weight: 600; font-size: 15px; }
      .close { align-self: auto; width: 24px; height: 24px; padding: 0; margin: -4px -6px 0 0;
        display: inline-flex; align-items: center; justify-content: center; font: 400 18px/1 var(--font-body);
        background: transparent; color: var(--ink-muted); border-radius: 6px; }
      .close:hover { background: var(--brand-tint); color: var(--ink); }
      .ask { color: var(--ink-muted); }
      .meaning { font-weight: 500; font-size: 14px; }
      button { align-self: flex-start; height: 30px; padding: 0 12px; font: 600 13px/1 var(--font-body);
        border: none; border-radius: 8px; background: var(--brand); color: var(--on-brand); cursor: pointer; }
      button:hover { background: var(--brand-strong); }
      button:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }`;
    const box = document.createElement('div');
    box.className = 'card';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Tự kiểm tra từ đã lưu');
    const word = document.createElement('div');
    word.className = 'word';
    const ask = document.createElement('div');
    ask.className = 'ask';
    ask.textContent = 'Bạn còn nhớ nghĩa?';
    const meaning = document.createElement('div');
    meaning.className = 'meaning';
    const reveal = document.createElement('button');
    reveal.type = 'button';
    reveal.textContent = 'Hiện nghĩa';
    reveal.addEventListener('click', () => {
      meaning.textContent = current?.word.meaning || 'Chưa có nghĩa. Mở Từ của tôi để chọn nghĩa.';
      meaning.hidden = false;
      reveal.hidden = true;
      ask.hidden = true;
    });
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'close';
    close.textContent = '×';
    close.title = 'Đóng (Esc)';
    close.setAttribute('aria-label', 'Đóng');
    close.addEventListener('click', hideCard);
    const head = document.createElement('div');
    head.className = 'head';
    head.append(word, close);
    box.append(head, ask, meaning, reveal);
    shadow.append(css, box);
    TV.appearance.get().then((v) => TV.appearance.apply(host, v));
    (document.body || document.documentElement).appendChild(host);
    card = { host, box, word, ask, meaning, reveal };
    return card;
  }

  function showCard(match) {
    const c = ensureCard();
    current = match;
    c.word.textContent = match.word.text;
    c.meaning.hidden = true;
    c.ask.hidden = false;
    c.reveal.hidden = false;
    const r = match.range.getBoundingClientRect();
    const left = Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - 252);
    c.box.style.left = `${Math.max(window.scrollX + 6, left)}px`;
    c.box.style.top = `${r.bottom + window.scrollY + 6}px`;
    // Ẩn/hiện chính khung thẻ trong Shadow DOM: host có style `all: initial` nên thuộc tính hidden trên host không có tác dụng
    c.box.hidden = false;
  }

  function hideCard() {
    clearTimeout(showTimer);
    pending = null;
    if (card) card.box.hidden = true;
    current = null;
  }

  /** Chỉ hiện khi chuột dừng trên cùng một từ đủ SHOW_DELAY. */
  function scheduleShow(m) {
    if (pending === m) return;
    pending = m;
    clearTimeout(showTimer);
    showTimer = setTimeout(() => {
      if (pending === m) showCard(m);
      pending = null;
    }, SHOW_DELAY);
  }

  function matchAt(x, y) {
    let node = null;
    let offset = 0;
    if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(x, y);
      if (p) {
        node = p.offsetNode;
        offset = p.offset;
      }
    } else if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      if (r) {
        node = r.startContainer;
        offset = r.startOffset;
      }
    }
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    const list = nodeMatches.get(node);
    if (!list) return null;
    const m = list.find((it) => offset >= it.start && offset <= it.end);
    if (!m) return null;
    // caret có thể "dính" vào từ gần nhất: kiểm tra chuột thật sự nằm trên chữ
    const rect = m.range.getBoundingClientRect();
    if (x < rect.left - 2 || x > rect.right + 2 || y < rect.top - 2 || y > rect.bottom + 2) return null;
    return m;
  }

  let rafPending = false;
  window.addEventListener(
    'mousemove',
    (e) => {
      if (!enabled || !matches.length || rafPending) return;
      if (card && e.composedPath().includes(card.host)) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const m = matchAt(e.clientX, e.clientY);
        if (m) {
          if (m !== current) scheduleShow(m);
        } else {
          // Rời khỏi từ: chỉ hủy thẻ đang chờ; thẻ đang mở đứng yên tới khi bấm ×
          pending = null;
          clearTimeout(showTimer);
        }
      });
    },
    { passive: true, capture: true },
  );
  // Đóng thẻ: nút ×, nhấn Esc, hoặc bấm ra ngoài thẻ (thẻ bám theo từ khi cuộn trang)
  document.addEventListener(
    'mousedown',
    (e) => {
      if (card && !e.composedPath().includes(card.host)) hideCard();
    },
    true,
  );
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hideCard(), true);

  // ---------- khởi động ----------

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[HL_KEY]) {
      words = (changes[HL_KEY].newValue && changes[HL_KEY].newValue.words) || [];
      buildRegex();
      scheduleScan(200);
    }
    if (area === 'sync' && changes[TV.SETTINGS_KEY]) {
      const next = (changes[TV.SETTINGS_KEY].newValue || {}).highlight !== false;
      if (next !== enabled) {
        enabled = next;
        if (!enabled) hideCard();
        scan();
      }
    }
  });

  load().then(() => {
    if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
