import { clearToken, readOriginalToken, readToken } from '@/auth/tokenStorage';
import type { ValidationErrorBody } from './types';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
).replace(/\/+$/, '');

/** Sự kiện phát ra khi server trả 401: AuthProvider nghe để đưa người dùng về /login. */
export const UNAUTHORIZED_EVENT = 'tv:unauthorized';

export class ApiError extends Error {
  readonly status: number;
  /** Lỗi theo từng trường (chỉ có với 422). */
  readonly errors: Record<string, string[]>;

  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }

  /** Câu lỗi đầu tiên của một trường, để hiện cạnh ô nhập. */
  field(name: string): string | undefined {
    return this.errors[name]?.[0];
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Query): string {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
  }

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (res.ok) return data as T;

  const message =
    (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
      ? data.message
      : null) ?? defaultMessage(res.status);

  // 401: token hết hạn. 403 ngoài /admin/*: tài khoản bị khóa (mục 2.3) → đăng xuất, hiện lý do.
  const isAuthCall = path.startsWith('/auth/');
  // Đang "đăng nhập với tư cách": 403 là hành động bị chặn (mục 9.1), không phải tài khoản bị khóa
  const impersonating = readOriginalToken() !== null;
  const lockedOut = res.status === 403 && !path.startsWith('/admin') && !impersonating;
  if (!isAuthCall && (res.status === 401 || lockedOut)) {
    // Đang impersonate thì AuthProvider tự khôi phục token gốc thay vì đăng xuất
    if (!impersonating) clearToken();
    window.dispatchEvent(
      new CustomEvent<string | null>(UNAUTHORIZED_EVENT, {
        detail: res.status === 403 ? message : null,
      }),
    );
    throw new ApiError(res.status, message);
  }

  if (res.status === 422) {
    const errors = (data as Partial<ValidationErrorBody> | null)?.errors ?? {};
    throw new ApiError(422, message, errors);
  }

  if (res.status === 429) {
    const retry = res.headers.get('Retry-After');
    throw new ApiError(429, retry ? `Bạn thao tác quá nhanh. Thử lại sau ${retry} giây.` : message);
  }

  // Lỗi máy chủ: không hiện thông báo kỹ thuật (tên lớp PHP, SQL…) cho người dùng
  if (res.status >= 500) {
    console.error(`[API ${res.status}] ${method} ${path}:`, message);
    throw new ApiError(res.status, 'Máy chủ đang gặp sự cố. Bạn thử lại sau ít phút nhé.');
  }

  throw new ApiError(res.status, message);
}

function defaultMessage(status: number): string {
  switch (status) {
    case 401:
      return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.';
    case 403:
      return 'Bạn không có quyền thực hiện thao tác này.';
    case 404:
      return 'Không tìm thấy.';
    case 409:
      return 'Thao tác không hợp lệ ở trạng thái hiện tại.';
    case 429:
      return 'Bạn thao tác quá nhanh. Thử lại sau.';
    default:
      return 'Có lỗi xảy ra. Thử lại sau.';
  }
}
