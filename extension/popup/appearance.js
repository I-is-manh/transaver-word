/** Nút chọn Hệ thống / Sáng / Tối trong popup (contract mục 6.4). */
(async () => {
  const A = globalThis.TV.appearance;
  const logo = document.getElementById('wordmark');
  const radios = [...document.querySelectorAll('input[name="appearance"]')];

  function render(v) {
    A.apply(document.documentElement, v);
    radios.forEach((r) => (r.checked = r.value === v));
    logo.src = A.resolve(v) === 'dark' ? '../icons/wordmark-dark.svg' : '../icons/wordmark.svg';
  }

  render(await A.get());
  A.watch(render);

  radios.forEach((r) =>
    r.addEventListener('change', () => {
      if (!r.checked) return;
      render(r.value);
      // background lưu local và PATCH /settings nếu đã kết nối tài khoản
      chrome.runtime.sendMessage({ type: 'TV_SET_APPEARANCE', appearance: r.value }).catch(() => {});
    }),
  );
})();
