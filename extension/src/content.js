/**
 * Content script: bôi đen văn bản → hiện icon → click icon → hiện khung dịch.
 * Toàn bộ giao diện nằm trong Shadow DOM để CSS của trang web không làm vỡ giao diện.
 */
(() => {
  if (window.__transaverLoaded) return;
  window.__transaverLoaded = true;

  const TV = globalThis.TV;
  const ICON_SIZE = 28;
  const PANEL_WIDTH = 340;
  const GAP = 6;

  let settings = { ...TV.DEFAULT_SETTINGS };
  let selectedText = '';
  let anchor = null; // vị trí vùng chọn, toạ độ theo trang
  let lastDetected = null;
  let requestSeq = 0;

  TV.getSettings().then((s) => {
    settings = s;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes[TV.SETTINGS_KEY]) return;
    settings = { ...TV.DEFAULT_SETTINGS, ...(changes[TV.SETTINGS_KEY].newValue || {}) };
    if (!settings.showIcon) hideIcon();
    if (ui) syncSelects();
  });

  // ---------- Giao diện (tạo lười, chỉ khi cần) ----------

  let ui = null;

  function ensureUI() {
    if (ui) return ui;

    const host = document.createElement('transaver-word');
    host.style.cssText =
      'all: initial; position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;';
    const shadow = host.attachShadow({ mode: 'closed' });

    // Dựng DOM bằng code thay vì innerHTML: các trang bật Trusted Types (Gmail, YouTube…) chặn innerHTML.
    const style = document.createElement('style');
    style.textContent = STYLES;

    ensureFonts();

    const icon = h('button', { class: 'tv-icon', type: 'button', title: 'Dịch (Transaver Word)', 'aria-label': 'Dịch đoạn đã chọn', hidden: '' }, [TV.icon('translate', 16)]);

    const src = h('select', { class: 'tv-lang tv-src', 'aria-label': 'Ngôn ngữ nguồn' });
    const swap = h('button', { class: 'tv-btn', type: 'button', title: 'Đổi chiều dịch', 'aria-label': 'Đổi chiều dịch' }, [TV.icon('swap')]);
    const tgt = h('select', { class: 'tv-lang tv-tgt', 'aria-label': 'Ngôn ngữ đích' });
    const close = h('button', { class: 'tv-btn', type: 'button', title: 'Đóng (Esc)', 'aria-label': 'Đóng' }, [TV.icon('close')]);
    const source = h('div', { class: 'tv-source' });
    const result = h('div', { class: 'tv-result', 'aria-live': 'polite' });
    const detected = h('span', { class: 'tv-detected' });
    const speak = h('button', { class: 'tv-btn', type: 'button', title: 'Đọc bản dịch', 'aria-label': 'Đọc bản dịch' }, [TV.icon('audio')]);
    const copy = h('button', { class: 'tv-btn', type: 'button', title: 'Sao chép bản dịch', 'aria-label': 'Sao chép bản dịch' }, [TV.icon('copy')]);

    const panel = h('div', { class: 'tv-panel', role: 'dialog', 'aria-label': 'Kết quả dịch', hidden: '' }, [
      h('div', { class: 'tv-langs' }, [src, swap, tgt, close]),
      source,
      result,
      h('div', { class: 'tv-footer' }, [detected, h('span', { class: 'tv-actions' }, [speak, copy])]),
    ]);

    shadow.append(style, icon, panel);

    ui = { host, icon, panel, src, tgt, swap, close, source, result, detected, speak, copy, lastTranslation: '' };

    TV.fillSelect(ui.src, { includeAuto: true, compact: true });
    TV.fillSelect(ui.tgt, { includeAuto: false, compact: true });
    syncSelects();

    // Giữ nguyên vùng bôi đen khi bấm vào icon.
    ui.icon.addEventListener('mousedown', (e) => e.preventDefault());
    ui.icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPanel();
    });

    ui.src.addEventListener('change', async () => {
      settings = await TV.saveSettings({ sourceLang: ui.src.value });
      runTranslate();
    });
    ui.tgt.addEventListener('change', async () => {
      settings = await TV.saveSettings({ targetLang: ui.tgt.value });
      runTranslate();
    });
    ui.swap.addEventListener('click', swapLanguages);
    ui.close.addEventListener('click', hideAll);
    ui.speak.addEventListener('click', speakTranslation);
    ui.copy.addEventListener('click', copyTranslation);

    (document.body || document.documentElement).appendChild(host);
    return ui;
  }

  function syncSelects() {
    ui.src.value = settings.sourceLang;
    ui.tgt.value = settings.targetLang;
    // Nếu mã đã lưu không có trong danh sách thì quay về mặc định.
    if (ui.src.value !== settings.sourceLang) ui.src.value = TV.AUTO;
    if (ui.tgt.value !== settings.targetLang) ui.tgt.value = TV.DEFAULT_SETTINGS.targetLang;
  }

  function isOurs(event) {
    return !!ui && event.composedPath().includes(ui.host);
  }

  // ---------- Bắt sự kiện bôi đen ----------

  document.addEventListener(
    'mouseup',
    (e) => {
      if (e.button !== 0 || isOurs(e)) return;
      // Đợi trình duyệt cập nhật vùng chọn xong.
      setTimeout(() => handleSelection(e), 0);
    },
    true,
  );

  document.addEventListener(
    'mousedown',
    (e) => {
      if (isOurs(e)) return;
      hideAll();
    },
    true,
  );

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') hideAll();
    },
    true,
  );

  window.addEventListener('resize', hideAll);

  function handleSelection(mouseEvent) {
    if (!settings.showIcon) return;
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (!text) {
      hideIcon();
      return;
    }

    let rect = null;
    if (sel.rangeCount) {
      const range = sel.getRangeAt(0);
      const rects = range.getClientRects();
      rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    }
    // Vùng chọn trong ô input/textarea không có toạ độ → dùng vị trí chuột.
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      rect = {
        left: mouseEvent.clientX,
        right: mouseEvent.clientX,
        top: mouseEvent.clientY,
        bottom: mouseEvent.clientY,
      };
    }

    selectedText = text;
    anchor = {
      left: rect.left + window.scrollX,
      right: rect.right + window.scrollX,
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
    };
    showIcon();
  }

  // ---------- Icon ----------

  function showIcon() {
    ensureUI();
    ui.panel.hidden = true;
    const maxLeft = window.scrollX + document.documentElement.clientWidth - ICON_SIZE - GAP;
    const left = Math.min(anchor.right + GAP, maxLeft);
    const top = anchor.bottom + GAP;
    ui.icon.style.left = `${Math.max(window.scrollX + GAP, left)}px`;
    ui.icon.style.top = `${top}px`;
    ui.icon.hidden = false;
  }

  function hideIcon() {
    if (ui) ui.icon.hidden = true;
  }

  function hideAll() {
    if (!ui) return;
    ui.icon.hidden = true;
    ui.panel.hidden = true;
    requestSeq++; // huỷ kết quả của yêu cầu đang chạy
  }

  // ---------- Khung dịch ----------

  function openPanel() {
    ensureUI();
    syncSelects();
    ui.icon.hidden = true;
    ui.source.textContent = selectedText;
    ui.panel.hidden = false;
    positionPanel();
    runTranslate();
  }

  function positionPanel() {
    const viewportW = document.documentElement.clientWidth;
    const viewportH = window.innerHeight;
    const width = Math.min(PANEL_WIDTH, viewportW - GAP * 2);
    ui.panel.style.width = `${width}px`;

    let left = anchor.left;
    const maxLeft = window.scrollX + viewportW - width - GAP;
    left = Math.max(window.scrollX + GAP, Math.min(left, maxLeft));

    const height = ui.panel.offsetHeight;
    let top = anchor.bottom + GAP;
    const spaceBelow = window.scrollY + viewportH - top;
    const spaceAbove = anchor.top - window.scrollY;
    if (spaceBelow < height + GAP && spaceAbove > spaceBelow) {
      top = anchor.top - height - GAP;
    }

    ui.panel.style.left = `${left}px`;
    ui.panel.style.top = `${top}px`;
  }

  async function runTranslate() {
    const seq = ++requestSeq;
    const sourceLang = settings.sourceLang;
    const targetLang = settings.targetLang;

    ui.lastTranslation = '';
    ui.detected.textContent = '';
    if (sourceLang === TV.AUTO) lastDetected = null;
    setResult('loading', 'Đang dịch…');

    if (selectedText.length > TV.MAX_TEXT_LENGTH) {
      setResult('error', `Đoạn đã chọn quá dài (tối đa ${TV.MAX_TEXT_LENGTH} ký tự).`);
      return;
    }

    let response;
    try {
      response = await chrome.runtime.sendMessage({
        type: 'TV_TRANSLATE',
        text: selectedText,
        sourceLang,
        targetLang,
      });
    } catch (_) {
      if (seq !== requestSeq) return;
      setResult('error', 'Extension vừa được cập nhật. Hãy tải lại trang (F5) để dùng tiếp.');
      return;
    }
    if (seq !== requestSeq) return; // người dùng đã đổi ngôn ngữ hoặc đóng khung

    if (!response || !response.ok) {
      setResult('error', response?.error || 'Dịch thất bại.');
      return;
    }

    const { translation, detectedLang } = response.data;
    ui.lastTranslation = decodeEntities(translation);
    setResult('ok', ui.lastTranslation);

    if (sourceLang === TV.AUTO && detectedLang) {
      lastDetected = detectedLang;
      ui.detected.textContent = `Phát hiện: ${TV.langName(detectedLang)}`;
    } else {
      ui.detected.textContent = '';
    }
    positionPanel();
  }

  function setResult(state, text) {
    ui.result.dataset.state = state;
    ui.result.textContent = text;
    const ok = state === 'ok';
    ui.copy.disabled = !ok;
    ui.speak.disabled = !ok;
  }

  async function swapLanguages() {
    let newTarget = settings.sourceLang;
    if (newTarget === TV.AUTO) {
      const found = lastDetected && TV.findLang(lastDetected);
      if (!found) return; // chưa biết ngôn ngữ nguồn thì không đổi được
      newTarget = found.code;
    }
    settings = await TV.saveSettings({ sourceLang: settings.targetLang, targetLang: newTarget });
    syncSelects();

    // Đổi chiều thì dịch bản dịch hiện tại ngược lại.
    if (ui.lastTranslation) {
      selectedText = ui.lastTranslation;
      ui.source.textContent = selectedText;
    }
    runTranslate();
  }

  function speakTranslation() {
    if (!ui.lastTranslation || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(ui.lastTranslation);
    u.lang = settings.targetLang;
    speechSynthesis.speak(u);
  }

  async function copyTranslation() {
    if (!ui.lastTranslation) return;
    let ok = true;
    try {
      await navigator.clipboard.writeText(ui.lastTranslation);
    } catch (_) {
      ok = false;
    }
    ui.copy.replaceChildren(TV.icon(ok ? 'check' : 'copy'));
    ui.copy.classList.toggle('is-done', ok);
    ui.copy.title = ok ? 'Đã sao chép' : 'Trang này không cho sao chép';
    setTimeout(() => {
      if (!ui) return;
      ui.copy.replaceChildren(TV.icon('copy'));
      ui.copy.classList.remove('is-done');
      ui.copy.title = 'Sao chép bản dịch';
    }, 1500);
  }

  /** MyMemory đôi khi trả về HTML entity như &#39; hay &quot;. Giải mã thủ công, không dùng innerHTML. */
  const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  function decodeEntities(str) {
    return String(str).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? m;
    });
  }

  /** Tạo phần tử: h('div', { class: 'x' }, [con] | 'chữ'). */
  function h(tag, attrs = {}, children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (typeof children === 'string') el.textContent = children;
    else if (Array.isArray(children)) el.append(...children);
    return el;
  }

  // ---------- Font thương hiệu ----------

  /**
   * @font-face phải khai báo ở document (Shadow DOM không tự nạp font).
   * Tên family có tiền tố "TW" để không đụng font của trang. Trang chặn font ngoài (CSP) thì dùng font hệ thống.
   */
  function ensureFonts() {
    if (document.getElementById('transaver-word-fonts')) return;
    const url = (f) => chrome.runtime.getURL(`fonts/${f}`);
    const style = document.createElement('style');
    style.id = 'transaver-word-fonts';
    style.textContent = [
      ['TW Body', 'BeVietnamPro-Regular.woff2', 400],
      ['TW Body', 'BeVietnamPro-Medium.woff2', 500],
      ['TW Body', 'BeVietnamPro-SemiBold.woff2', 600],
    ]
      .map(
        ([family, file, weight]) =>
          `@font-face{font-family:"${family}";src:url("${url(file)}") format("woff2");font-weight:${weight};font-style:normal;font-display:swap;}`,
      )
      .join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  // ---------- Giao diện: token màu theo brand/tokens.json ----------

  const STYLES = `
    :host {
      all: initial;
      --brand: #0F6E66; --brand-strong: #0B5650; --brand-tint: #E3F3F0; --on-brand: #FFFFFF;
      --ink: #14201F; --ink-muted: #56645F;
      --surface-0: #F7F9F8; --surface-1: #FFFFFF;
      --line: #D9E2DF; --line-strong: #7D8C88;
      --danger: #B42318;
      --shadow-popover: 0 12px 32px rgba(20, 32, 31, 0.18);
      --font-body: "TW Body", "Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :host {
        --brand: #3CC4B4; --brand-strong: #6BD9CB; --brand-tint: #12302D; --on-brand: #0E1514;
        --ink: #E8EFEE; --ink-muted: #9AAAA6;
        --surface-0: #0E1514; --surface-1: #162120;
        --line: #2A3836; --line-strong: #5F716D;
        --danger: #F97066;
        --shadow-popover: 0 12px 32px rgba(0, 0, 0, 0.55);
      }
    }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }

    /* Icon nổi khi bôi đen */
    .tv-icon {
      position: absolute;
      width: ${ICON_SIZE}px; height: ${ICON_SIZE}px;
      display: flex; align-items: center; justify-content: center;
      padding: 0; margin: 0;
      border: none; border-radius: 8px;
      background: var(--brand); color: var(--on-brand);
      box-shadow: var(--shadow-popover);
      cursor: pointer;
      animation: tv-pop .12s ease-out;
    }
    .tv-icon:hover { background: var(--brand-strong); }

    /* Khung dịch */
    .tv-panel {
      position: absolute;
      display: flex; flex-direction: column; gap: 8px;
      font: 400 14px/20px var(--font-body);
      color: var(--ink);
      background: var(--surface-1);
      border: 1px solid var(--line);
      border-radius: 10px;
      box-shadow: var(--shadow-popover);
      padding: 12px;
      animation: tv-pop .12s ease-out;
      -webkit-font-smoothing: antialiased;
    }

    .tv-langs { display: flex; align-items: center; gap: 4px; }
    .tv-lang {
      flex: 1; min-width: 0;
      font: 500 13px/18px var(--font-body); color: var(--ink);
      background: var(--surface-0); border: 1px solid var(--line-strong); border-radius: 6px;
      padding: 5px 6px; cursor: pointer;
    }

    .tv-btn {
      flex: none;
      width: 32px; height: 32px;
      display: inline-flex; align-items: center; justify-content: center;
      padding: 0; margin: 0;
      background: transparent; color: var(--ink);
      border: none; border-radius: 6px; cursor: pointer;
    }
    .tv-btn:hover:not(:disabled) { background: var(--brand-tint); }
    .tv-btn:disabled { opacity: .35; cursor: default; }
    .tv-btn.is-done { color: var(--brand); }

    .tv-icon:focus-visible, .tv-btn:focus-visible, .tv-lang:focus-visible {
      outline: 2px solid var(--brand); outline-offset: 2px;
    }

    .tv-source {
      font: 400 12px/16px var(--font-body); color: var(--ink-muted);
      max-height: 32px; overflow: hidden;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      word-break: break-word;
    }
    .tv-result {
      font: 500 17px/24px var(--font-body);
      white-space: pre-wrap; word-break: break-word;
      max-height: 240px; overflow-y: auto;
    }
    .tv-result[data-state="loading"] { font-weight: 400; font-size: 14px; color: var(--ink-muted); }
    .tv-result[data-state="error"] { font-weight: 400; font-size: 13px; line-height: 18px; color: var(--danger); }

    .tv-footer {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding-top: 8px; border-top: 1px solid var(--line);
      font: 400 12px/16px var(--font-body); color: var(--ink-muted);
    }
    .tv-actions { display: flex; gap: 2px; }

    @keyframes tv-pop { from { opacity: 0; transform: scale(.92); } to { opacity: 1; transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) { .tv-icon, .tv-panel { animation: none; } }
  `;
})();
