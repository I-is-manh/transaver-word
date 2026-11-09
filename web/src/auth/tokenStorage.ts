/** Token đăng nhập lưu trong localStorage. Bọc try/catch vì có thể bị chặn (chế độ riêng tư…). */
const KEY = 'tv.auth.token';

/** Báo cho extension (web-bridge.js) biết phiên đăng nhập vừa đổi. */
const notify = () => window.dispatchEvent(new Event('tv:auth-changed'));

export function readToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string): void {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // Không lưu được thì vẫn dùng token trong phiên hiện tại.
  }
  notify();
}

export function clearToken(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // bỏ qua
  }
  notify();
}

// ---- Token gốc của superadmin khi "Đăng nhập với tư cách" (mục 9.1)
const ORIGINAL_KEY = 'tv.auth.originalToken';

export function readOriginalToken(): string | null {
  try {
    return localStorage.getItem(ORIGINAL_KEY);
  } catch {
    return null;
  }
}

export function writeOriginalToken(token: string): void {
  try {
    localStorage.setItem(ORIGINAL_KEY, token);
  } catch {
    // bỏ qua
  }
}

export function clearOriginalToken(): void {
  try {
    localStorage.removeItem(ORIGINAL_KEY);
  } catch {
    // bỏ qua
  }
}
