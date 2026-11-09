/**
 * Cấu hình kết nối backend. File duy nhất chứa địa chỉ API (docs/api-contract.md mục 1.1).
 * Đổi địa chỉ thì nhớ sửa cả host_permissions trong manifest.json.
 */
(function (global) {
  global.TV_CONFIG = Object.freeze({
    API_BASE_URL: 'http://localhost:8000/api',
    WEB_APP_URL: 'http://localhost:5173',
  });
})(globalThis);
