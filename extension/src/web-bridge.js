/**
 * Cầu nối web app → extension: extension không có form đăng nhập riêng.
 * Chạy trên trang localhost (mọi cổng) nhưng chỉ hoạt động khi trang có
 * <meta name="transaver-web-app">. Đọc token đăng nhập của web app (localStorage 'tv.auth.token')
 * và báo cho background; web đăng xuất thì extension cũng ngắt kết nối.
 */
(() => {
  if (window.__transaverBridgeLoaded) return;
  window.__transaverBridgeLoaded = true;
  if (!document.querySelector('meta[name="transaver-web-app"]')) return;

  const TOKEN_KEY = 'tv.auth.token';
  let last;

  function read() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (_) {
      return null;
    }
  }

  function sync() {
    const token = read();
    if (token === last) return;
    last = token;
    chrome.runtime
      .sendMessage({ type: 'TV_WEB_TOKEN', token, origin: location.origin })
      .catch(() => {}); // extension vừa cập nhật: bỏ qua
  }

  // Giao diện sáng/tối của web (contract mục 6.4). Đang "xem với tư cách" người khác thì bỏ qua.
  const APPEARANCE_KEY = 'tv.appearance';
  let lastAppearance;
  function syncAppearance() {
    let appearance = null;
    let impersonating = false;
    try {
      appearance = localStorage.getItem(APPEARANCE_KEY);
      impersonating = localStorage.getItem('tv.auth.originalToken') !== null;
    } catch (_) {
      return;
    }
    if (impersonating || !appearance || appearance === lastAppearance) return;
    lastAppearance = appearance;
    chrome.runtime
      .sendMessage({ type: 'TV_WEB_APPEARANCE', appearance, origin: location.origin })
      .catch(() => {});
  }

  sync();
  // Lần đầu chỉ ghi nhớ giá trị hiện tại (giá trị server do background lấy), chỉ báo khi web đổi
  try {
    lastAppearance = localStorage.getItem(APPEARANCE_KEY);
  } catch (_) {
    lastAppearance = null;
  }
  // Web app phát sự kiện khi đăng nhập/đăng xuất / đổi giao diện; tab khác thì nghe 'storage'; thêm kiểm tra định kỳ.
  window.addEventListener('tv:auth-changed', sync);
  window.addEventListener('tv:appearance-changed', syncAppearance);
  window.addEventListener('storage', (e) => {
    if (e.key === TOKEN_KEY) sync();
    if (e.key === APPEARANCE_KEY) syncAppearance();
  });
  setInterval(() => {
    sync();
    syncAppearance();
  }, 3000);
})();
