/**
 * Lấy câu chứa từ được bôi đen để lưu làm ngữ cảnh (docs/api-contract.md mục 3.2, 3.4).
 * - Câu tối đa 500 ký tự; dài hơn thì cắt quanh từ.
 * - word_offset / word_length tính theo đơn vị UTF-16 (chính là chỉ số chuỗi của JS).
 * Phần xử lý chuỗi (extractSentence) thuần JS, không đụng DOM, để dễ kiểm thử.
 */
(function (root) {
  const MAX_SENTENCE = 500;
  const BLOCK_TAGS = new Set([
    'P', 'LI', 'TD', 'TH', 'DD', 'DT', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'ARTICLE', 'SECTION', 'DIV', 'FIGCAPTION', 'CAPTION', 'PRE', 'BODY', 'MAIN', 'ASIDE',
    'HEADER', 'FOOTER', 'LABEL', 'SUMMARY',
  ]);
  const END_PUNCT = /[.!?…。！？]/;
  const ABBREV = /(?:^|[\s(])(?:mr|mrs|ms|dr|prof|st|sr|jr|vs|etc|e\.g|i\.e|no|fig|approx|u\.s)$/i;

  /** Dấu chấm ở vị trí i có phải kết câu thật không (không phải "Dr.", "e.g."). */
  function isSentenceEnd(full, i) {
    if (!END_PUNCT.test(full[i])) return false;
    if (full[i] !== '.') return true;
    return !ABBREV.test(full.slice(Math.max(0, i - 8), i));
  }

  /** Thu gọn khoảng trắng của s[from, to), giữ ánh xạ vị trí của đoạn [a, b). */
  function collapse(s, from, to, a, b) {
    let out = '';
    let na = -1;
    let nb = -1;
    let prevSpace = true; // bỏ khoảng trắng đầu
    for (let i = from; i < to; i++) {
      if (i === a) na = out.length;
      if (i === b) nb = out.length;
      const ch = s[i];
      if (/\s/.test(ch)) {
        if (!prevSpace) {
          out += ' ';
          prevSpace = true;
        }
      } else {
        out += ch;
        prevSpace = false;
      }
    }
    if (b >= to) nb = out.length;
    if (na === -1) na = out.length;
    // bỏ khoảng trắng cuối
    let trimmed = out.replace(/\s+$/, '');
    if (nb > trimmed.length) nb = trimmed.length;
    return { text: trimmed, start: na, end: nb };
  }

  /**
   * @param {string} full  toàn bộ văn bản của khối chứa vùng chọn
   * @param {number} start vị trí bắt đầu từ trong full
   * @param {number} end   vị trí kết thúc (không gồm)
   * @returns {{ sentence: string, word_offset: number, word_length: number }}
   */
  function extractSentence(full, start, end) {
    // Bỏ khoảng trắng hai đầu vùng chọn
    while (start < end && /\s/.test(full[start])) start++;
    while (end > start && /\s/.test(full[end - 1])) end--;

    // Đầu câu: sau dấu kết câu + khoảng trắng gần nhất trước từ, hoặc sau xuống dòng
    let s = start;
    while (s > 0) {
      const ch = full[s - 1];
      if (ch === '\n') break;
      if (/\s/.test(ch) && s >= 2 && isSentenceEnd(full, s - 2)) break;
      s--;
    }
    // Cuối câu: tới dấu kết câu (gồm cả dấu) theo sau là khoảng trắng / hết chuỗi, hoặc xuống dòng
    let e = end;
    while (e < full.length) {
      const ch = full[e];
      if (ch === '\n') break;
      if (isSentenceEnd(full, e) && (e + 1 >= full.length || /\s/.test(full[e + 1]))) {
        e++;
        break;
      }
      e++;
    }

    let { text, start: ws, end: we } = collapse(full, s, e, start, end);

    if (text.length > MAX_SENTENCE) {
      // Cắt quanh từ, ưu tiên cắt ở khoảng trắng
      const wordLen = we - ws;
      const room = Math.max(0, MAX_SENTENCE - wordLen);
      let left = Math.max(0, ws - Math.floor(room / 2));
      let right = Math.min(text.length, left + MAX_SENTENCE);
      left = Math.max(0, right - MAX_SENTENCE);
      if (left > 0) {
        const sp = text.indexOf(' ', left);
        if (sp !== -1 && sp < ws) left = sp + 1;
      }
      if (right < text.length) {
        const sp = text.lastIndexOf(' ', right);
        if (sp > we) right = sp;
      }
      text = text.slice(left, right).trim();
      ws -= left;
      we -= left;
    }
    if (ws < 0 || we > text.length || we <= ws) {
      return { sentence: text.slice(0, MAX_SENTENCE), word_offset: null, word_length: null };
    }
    return { sentence: text, word_offset: ws, word_length: we - ws };
  }

  /** Phần tử khối gần nhất chứa node. */
  function blockOf(node) {
    let el = node.nodeType === 1 ? node : node.parentElement;
    while (el && el !== document.body) {
      if (BLOCK_TAGS.has(el.tagName)) return el;
      const d = getComputedStyle(el).display;
      if (d && !d.startsWith('inline') && d !== 'contents') return el;
      el = el.parentElement;
    }
    return el || document.body;
  }

  /**
   * Lấy ngữ cảnh từ vùng chọn hiện tại của trang.
   * @returns {{ sentence: string, word_offset: number|null, word_length: number|null } | null}
   */
  function captureFromSelection(selection, selectedText) {
    try {
      // Vùng chọn trong ô nhập
      const active = document.activeElement;
      if (active && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && active.type === 'text'))) {
        const v = active.value || '';
        const a = active.selectionStart ?? 0;
        const b = active.selectionEnd ?? a;
        if (b > a) return extractSentence(v, a, b);
      }
      if (!selection || !selection.rangeCount) return null;
      const range = selection.getRangeAt(0);
      const block = blockOf(range.commonAncestorContainer);
      const pre = document.createRange();
      pre.selectNodeContents(block);
      pre.setEnd(range.startContainer, range.startOffset);
      const all = document.createRange();
      all.selectNodeContents(block);
      const full = all.toString();
      const start = pre.toString().length;
      const end = start + range.toString().length;
      if (end > full.length) return null;
      return extractSentence(full, start, end);
    } catch (_) {
      return selectedText
        ? { sentence: selectedText.slice(0, MAX_SENTENCE), word_offset: 0, word_length: Math.min(selectedText.length, MAX_SENTENCE) }
        : null;
    }
  }

  root.TV = root.TV || {};
  root.TV.extractSentence = extractSentence;
  root.TV.captureContext = captureFromSelection;
})(globalThis);
