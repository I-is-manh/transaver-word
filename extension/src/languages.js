/**
 * Danh sách ngôn ngữ + helper đọc/ghi cài đặt.
 * Dùng chung cho content script, background (importScripts) và popup (<script>).
 * Gắn vào globalThis.TV vì content script / service worker cổ điển không dùng được ES module.
 */
(function (root) {
  const AUTO = 'auto';
  const SETTINGS_KEY = 'tv_settings';

  /** Mã ngôn ngữ theo chuẩn mà MyMemory hỗ trợ (ISO 639-1, riêng tiếng Trung có vùng). */
  const LANGUAGES = [
    { code: 'en', name: 'Tiếng Anh', native: 'English' },
    { code: 'vi', name: 'Tiếng Việt', native: 'Tiếng Việt' },
    { code: 'zh-CN', name: 'Tiếng Trung (Giản thể)', native: '简体中文' },
    { code: 'zh-TW', name: 'Tiếng Trung (Phồn thể)', native: '繁體中文' },
    { code: 'ja', name: 'Tiếng Nhật', native: '日本語' },
    { code: 'ko', name: 'Tiếng Hàn', native: '한국어' },
    { code: 'fr', name: 'Tiếng Pháp', native: 'Français' },
    { code: 'de', name: 'Tiếng Đức', native: 'Deutsch' },
    { code: 'es', name: 'Tiếng Tây Ban Nha', native: 'Español' },
    { code: 'pt', name: 'Tiếng Bồ Đào Nha', native: 'Português' },
    { code: 'it', name: 'Tiếng Ý', native: 'Italiano' },
    { code: 'ru', name: 'Tiếng Nga', native: 'Русский' },
    { code: 'th', name: 'Tiếng Thái', native: 'ไทย' },
    { code: 'id', name: 'Tiếng Indonesia', native: 'Bahasa Indonesia' },
    { code: 'ms', name: 'Tiếng Mã Lai', native: 'Bahasa Melayu' },
    { code: 'tl', name: 'Tiếng Philippines', native: 'Filipino' },
    { code: 'km', name: 'Tiếng Khmer', native: 'ខ្មែរ' },
    { code: 'lo', name: 'Tiếng Lào', native: 'ລາວ' },
    { code: 'hi', name: 'Tiếng Hindi', native: 'हिन्दी' },
    { code: 'ar', name: 'Tiếng Ả Rập', native: 'العربية' },
    { code: 'tr', name: 'Tiếng Thổ Nhĩ Kỳ', native: 'Türkçe' },
    { code: 'nl', name: 'Tiếng Hà Lan', native: 'Nederlands' },
    { code: 'pl', name: 'Tiếng Ba Lan', native: 'Polski' },
    { code: 'uk', name: 'Tiếng Ukraina', native: 'Українська' },
    { code: 'cs', name: 'Tiếng Séc', native: 'Čeština' },
    { code: 'sv', name: 'Tiếng Thụy Điển', native: 'Svenska' },
    { code: 'da', name: 'Tiếng Đan Mạch', native: 'Dansk' },
    { code: 'no', name: 'Tiếng Na Uy', native: 'Norsk' },
    { code: 'fi', name: 'Tiếng Phần Lan', native: 'Suomi' },
    { code: 'el', name: 'Tiếng Hy Lạp', native: 'Ελληνικά' },
    { code: 'he', name: 'Tiếng Do Thái', native: 'עברית' },
    { code: 'hu', name: 'Tiếng Hungary', native: 'Magyar' },
    { code: 'ro', name: 'Tiếng Romania', native: 'Română' },
  ];

  const DEFAULT_SETTINGS = {
    sourceLang: AUTO, // A: ngôn ngữ nguồn
    targetLang: 'vi', // B: ngôn ngữ đích
    showIcon: true, // hiện icon khi bôi đen
    highlight: true, // gạch chân từ đã lưu khi lướt web (mục 8.4)
  };

  const byCode = new Map(LANGUAGES.map((l) => [l.code.toLowerCase(), l]));

  /** Tìm ngôn ngữ theo mã, chấp nhận cả dạng có vùng như "en-GB" → "en". */
  function findLang(code) {
    if (!code) return null;
    const c = String(code).toLowerCase();
    return byCode.get(c) || byCode.get(c.split('-')[0]) || null;
  }

  function langName(code) {
    if (code === AUTO) return 'Tự nhận diện';
    const l = findLang(code);
    return l ? l.name : String(code);
  }

  /** So sánh hai mã ngôn ngữ, bỏ qua phần vùng (trừ tiếng Trung). */
  function sameLang(a, b) {
    if (!a || !b) return false;
    const la = findLang(a);
    const lb = findLang(b);
    if (la && lb) return la.code === lb.code;
    return String(a).toLowerCase().split('-')[0] === String(b).toLowerCase().split('-')[0];
  }

  async function getSettings() {
    try {
      const stored = await chrome.storage.sync.get(SETTINGS_KEY);
      return { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}) };
    } catch (_) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async function saveSettings(patch) {
    const current = await getSettings();
    const next = { ...current, ...patch };
    await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
    return next;
  }

  /** Đổ danh sách ngôn ngữ vào một thẻ <select>. */
  function fillSelect(select, { includeAuto, compact = false }) {
    select.textContent = '';
    if (includeAuto) {
      const opt = document.createElement('option');
      opt.value = AUTO;
      opt.textContent = 'Tự nhận diện';
      select.appendChild(opt);
    }
    for (const l of LANGUAGES) {
      const opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent =
        !compact && l.native && l.native !== l.name ? `${l.name} (${l.native})` : l.name;
      opt.title = l.native;
      select.appendChild(opt);
    }
  }

  root.TV = {
    ...(root.TV || {}),
    AUTO,
    SETTINGS_KEY,
    LANGUAGES,
    DEFAULT_SETTINGS,
    MAX_TEXT_LENGTH: 500, // giới hạn của MyMemory
    findLang,
    langName,
    sameLang,
    getSettings,
    saveSettings,
    fillSelect,
  };
})(globalThis);
