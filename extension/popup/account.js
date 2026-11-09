/**
 * Khu vực tài khoản trong popup: chỉ hiện trạng thái. Không có form đăng nhập / đăng ký;
 * extension tự kết nối theo phiên đăng nhập của web app (src/web-bridge.js).
 */
(async () => {
  const $ = (id) => document.getElementById(id);
  const loading = $('accountLoading');
  const accountIn = $('accountIn');
  const accountOut = $('accountOut');
  const accountEmail = $('accountEmail');

  function render(auth) {
    loading.hidden = true;
    accountIn.hidden = !auth;
    accountOut.hidden = !!auth;
    if (auth) accountEmail.textContent = auth.user.email;
  }

  async function openWeb(path) {
    const stored = (await chrome.storage.local.get('tvWebOrigin')).tvWebOrigin;
    chrome.tabs.create({ url: `${stored || globalThis.TV_CONFIG.WEB_APP_URL}${path}` });
    window.close();
  }

  $('openWebIn').addEventListener('click', () => openWeb('/'));
  $('openWebOut').addEventListener('click', () => openWeb('/login'));

  // Web đăng nhập / đăng xuất trong lúc popup đang mở → cập nhật ngay
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && 'tvAuth' in changes) {
      const next = changes.tvAuth.newValue;
      render(next && next.token ? next : null);
    }
  });

  try {
    const res = await chrome.runtime.sendMessage({ type: 'TV_AUTH_STATE' });
    const auth = res?.ok ? res.data : null;
    render(auth);
    // Mỗi lần mở popup: làm mới cài đặt, lịch nhắc và danh sách từ để gạch chân (mục 6.3, 8.4)
    if (auth) chrome.runtime.sendMessage({ type: 'TV_REFRESH' }).catch(() => {});
  } catch {
    render(null);
  }
})();
