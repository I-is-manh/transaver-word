/**
 * Giao diện sáng/tối dùng chung cho popup, khung dịch và highlight (contract mục 6.4).
 * chrome.storage.local['tvAppearance'] = "system" | "light" | "dark".
 * system → bỏ data-tv-mode (theo hệ điều hành); light/dark → đặt data-tv-mode trên phần tử gốc.
 */
(function (root) {
  const KEY = 'tvAppearance';
  const VALUES = ['system', 'light', 'dark'];
  const mq = root.matchMedia ? root.matchMedia('(prefers-color-scheme: dark)') : null;

  const valid = (v) => (VALUES.includes(v) ? v : 'system');

  async function get() {
    try {
      return valid((await chrome.storage.local.get(KEY))[KEY]);
    } catch (_) {
      return 'system';
    }
  }

  /** Chế độ thực tế: "light" | "dark". */
  function resolve(appearance) {
    if (appearance === 'light' || appearance === 'dark') return appearance;
    return mq && mq.matches ? 'dark' : 'light';
  }

  function apply(el, appearance) {
    if (!el) return;
    if (appearance === 'light' || appearance === 'dark') el.setAttribute('data-tv-mode', appearance);
    else el.removeAttribute('data-tv-mode');
  }

  /** Gọi cb(appearance) khi giá trị lưu đổi hoặc khi hệ điều hành đổi sáng/tối. */
  function watch(cb) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[KEY]) cb(valid(changes[KEY].newValue));
    });
    if (mq) mq.addEventListener('change', () => get().then(cb));
  }

  root.TV = root.TV || {};
  root.TV.appearance = { KEY, VALUES, valid, get, resolve, apply, watch };
})(globalThis);
