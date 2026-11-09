/**
 * Service worker: nhận yêu cầu dịch từ content script / popup và gọi API dịch.
 * Nhà cung cấp hiện tại: MyMemory (miễn phí, không cần API key, ~5000 lượt/ngày/IP).
 * Đồng thời giữ phiên đăng nhập backend: popup và content script không gọi API trực tiếp.
 */
importScripts('languages.js', 'config.js');

const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';
const REQUEST_TIMEOUT_MS = 10000;
const CACHE_LIMIT = 300;
const cache = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  // Ghi cài đặt mặc định nếu chưa có, để lần đầu cài là có cặp ngôn ngữ A → B.
  const stored = await chrome.storage.sync.get(TV.SETTINGS_KEY);
  if (!stored[TV.SETTINGS_KEY]) {
    await chrome.storage.sync.set({ [TV.SETTINGS_KEY]: { ...TV.DEFAULT_SETTINGS } });
  }
});

const MESSAGE_HANDLERS = {
  TV_TRANSLATE: (message) => translate(message),
  TV_AUTH_STATE: () => getAuth(),
  TV_WEB_TOKEN: (message, sender) => acceptWebToken(message, sender),
  TV_SET_APPEARANCE: (message) => setAppearance(message.appearance),
  TV_WEB_APPEARANCE: (message, sender) => acceptWebAppearance(message, sender),
  TV_SAVE_WORD: (message) => saveWord(message.payload),
  TV_REFRESH: () => refreshAll(),
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = message && MESSAGE_HANDLERS[message.type];
  if (!handler) return false;
  handler(message, _sender)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) =>
      sendResponse({
        ok: false,
        error: err?.message || String(err),
        errors: err?.errors || null,
        status: err?.status ?? null,
      }),
    );
  return true; // giữ kênh mở cho phản hồi bất đồng bộ
});

/* ------------------------------------------------------------------ */
/* Đăng nhập backend (docs/api-contract.md mục 2)                      */
/* ------------------------------------------------------------------ */

const AUTH_KEY = 'tvAuth'; // chrome.storage.local: { token, user }
const API_TIMEOUT_MS = 10000;

class ApiError extends Error {
  constructor(status, message, errors = null) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

/** @returns {Promise<{ token: string, user: object } | null>} */
async function getAuth() {
  const stored = await chrome.storage.local.get(AUTH_KEY);
  const auth = stored[AUTH_KEY];
  return auth && auth.token && auth.user ? auth : null;
}

/**
 * Nhận token từ web app (src/web-bridge.js). Extension dùng chung phiên đăng nhập với web:
 * web đăng nhập → extension kết nối; web đăng xuất (token null) → extension ngắt.
 */
async function acceptWebToken({ token, origin }, sender) {
  // Chỉ tin content script của chính extension, chạy trên trang localhost
  if (sender?.id !== chrome.runtime.id || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '')) {
    throw new Error('Nguồn không hợp lệ.');
  }
  await chrome.storage.local.set({ [WEB_ORIGIN_KEY]: origin });
  const current = await getAuth();
  if (!token) {
    if (current) await clearSession();
    return null;
  }
  if (current && current.token === token) return current;
  // Kiểm tra token mà không làm hỏng phiên hiện tại nếu token lỗi
  let user;
  try {
    ({ user } = await apiNoSessionSideEffects('/me', token));
  } catch (err) {
    return current;
  }
  // Mục 9.1: extension không nhận phiên "đăng nhập với tư cách" — giữ nguyên phiên đang có
  if (user.impersonator) return current;
  const auth = { token, user };
  await chrome.storage.local.set({ [AUTH_KEY]: auth });
  refreshAll().catch(() => {});
  return auth;
}

/** GET bằng một token cụ thể, không xóa phiên đang lưu khi lỗi (khác api()). */
async function apiNoSessionSideEffects(path, token) {
  const res = await fetch(`${TV_CONFIG.API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.message || `HTTP ${res.status}`);
  return data;
}

const WEB_ORIGIN_KEY = 'tvWebOrigin';

/* ------------------------------------------------------------------ */
/* Giao diện sáng/tối (contract mục 6.4)                                */
/* ------------------------------------------------------------------ */

const APPEARANCE_KEY = 'tvAppearance';
const validAppearance = (v) => (['system', 'light', 'dark'].includes(v) ? v : 'system');

/** Popup đổi giao diện: lưu local, đã kết nối thì PATCH /settings. */
async function setAppearance(value) {
  const appearance = validAppearance(value);
  await chrome.storage.local.set({ [APPEARANCE_KEY]: appearance });
  if (!(await getAuth())) return { appearance, synced: false };
  const { settings } = await api('/settings', { method: 'PATCH', body: { appearance } });
  await chrome.storage.local.set({ [SETTINGS_CACHE_KEY]: settings });
  return { appearance, synced: true };
}

/** Web app đổi giao diện (web-bridge.js): web đã tự PATCH, extension chỉ cập nhật local. */
async function acceptWebAppearance({ appearance, origin }, sender) {
  if (sender?.id !== chrome.runtime.id || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '')) {
    throw new Error('Nguồn không hợp lệ.');
  }
  const v = validAppearance(appearance);
  await chrome.storage.local.set({ [APPEARANCE_KEY]: v });
  return { appearance: v };
} // địa chỉ web app thật (cổng có thể khác 5173)

async function webAppUrl(path = '') {
  const stored = (await chrome.storage.local.get(WEB_ORIGIN_KEY))[WEB_ORIGIN_KEY];
  return `${stored || TV_CONFIG.WEB_APP_URL}${path}`;
}

async function clearSession() {
  await chrome.storage.local.remove([AUTH_KEY, SETTINGS_CACHE_KEY, HIGHLIGHT_KEY]);
  await chrome.alarms.clear(REMINDER_ALARM);
}

/**
 * Gọi backend. Tự gắn token đang lưu (trừ khi truyền token: null).
 * 401 → xóa phiên đã lưu. 422 → ApiError kèm errors theo trường.
 */
async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const bearer = token === undefined ? (await getAuth())?.token : token;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${TV_CONFIG.API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new ApiError(0, 'Máy chủ phản hồi quá lâu, thử lại sau.');
    throw new ApiError(0, 'Không kết nối được máy chủ Transaver. Kiểm tra mạng.');
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.ok) return data;

  const message = (data && data.message) || `Máy chủ lỗi (HTTP ${res.status}).`;
  if ((res.status === 401 || res.status === 403) && path !== '/auth/logout' && path !== '/auth/login') {
    // 401: token hết hạn. 403: tài khoản bị khóa (mục 2.3) — extension không gọi /admin/* nên mọi 403 đều là khóa.
    await clearSession();
  }
  if (res.status === 429) {
    const retry = res.headers.get('Retry-After');
    throw new ApiError(429, retry ? `Thử lại sau ${retry} giây.` : message);
  }
  throw new ApiError(res.status, message, res.status === 422 ? data?.errors || null : null);
}

/**
 * @param {{ text: string, sourceLang: string, targetLang: string }} args
 * @returns {Promise<{ translation: string, sourceLang: string, detectedLang: string|null, targetLang: string, provider: string }>}
 */
async function translate({ text, sourceLang, targetLang }) {
  const q = String(text || '').trim();
  if (!q) throw new Error('Chưa có nội dung để dịch.');
  if (q.length > TV.MAX_TEXT_LENGTH) {
    throw new Error(`Đoạn văn quá dài, tối đa ${TV.MAX_TEXT_LENGTH} ký tự.`);
  }
  if (!targetLang || targetLang === TV.AUTO) throw new Error('Hãy chọn ngôn ngữ đích.');
  if (sourceLang !== TV.AUTO && TV.sameLang(sourceLang, targetLang)) {
    throw new Error('Ngôn ngữ nguồn và ngôn ngữ đích đang giống nhau.');
  }

  const key = `${sourceLang}|${targetLang}|${q}`;
  if (cache.has(key)) return cache.get(key);

  const params = new URLSearchParams({
    q,
    langpair: `${sourceLang === TV.AUTO ? 'autodetect' : sourceLang}|${targetLang}`,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let data;
  try {
    const res = await fetch(`${MYMEMORY_ENDPOINT}?${params}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Máy chủ dịch lỗi (HTTP ${res.status}).`);
    data = await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Máy chủ dịch phản hồi quá lâu, thử lại sau.');
    if (err instanceof TypeError) throw new Error('Không kết nối được máy chủ dịch. Kiểm tra mạng.');
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const status = Number(data?.responseStatus);
  const details = String(data?.responseDetails || '');
  if (status !== 200) {
    if (/DISTINCT LANGUAGES/i.test(details)) {
      throw new Error('Văn bản này đã ở ngôn ngữ đích rồi.');
    }
    if (status === 429 || data?.quotaFinished || /QUOTA|LIMIT/i.test(details)) {
      throw new Error('Đã hết lượt dịch miễn phí hôm nay. Thử lại vào ngày mai.');
    }
    throw new Error(details || 'Dịch thất bại.');
  }

  const translation = String(data?.responseData?.translatedText || '').trim();
  if (!translation) throw new Error('Không nhận được kết quả dịch.');
  if (/MYMEMORY WARNING/i.test(translation)) {
    throw new Error('Đã hết lượt dịch miễn phí hôm nay. Thử lại vào ngày mai.');
  }

  const detectedLang =
    sourceLang === TV.AUTO ? data.responseData.detectedLanguage || null : sourceLang;

  const result = {
    translation,
    sourceLang,
    detectedLang,
    targetLang,
    provider: 'mymemory',
  };

  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}

/* ------------------------------------------------------------------ */
/* Lưu từ (mục 3.4, 3.9)                                                */
/* ------------------------------------------------------------------ */

const SETTINGS_CACHE_KEY = 'tvUserSettings'; // GET /api/settings gần nhất
const HIGHLIGHT_KEY = 'tvHighlight'; // { generated_at, words }

async function requireAuth() {
  const auth = await getAuth();
  if (!auth) throw new ApiError(401, 'Đăng nhập trên trang Transaver Word để lưu từ.');
  return auth;
}

async function saveWord(payload = {}) {
  await requireAuth();
  const settings = (await chrome.storage.local.get(SETTINGS_CACHE_KEY))[SETTINGS_CACHE_KEY];
  const body = {
    text: String(payload.text || '').trim(),
    source_lang: payload.source_lang,
    target_lang: payload.target_lang,
    sentence: String(payload.sentence || '').slice(0, 500),
    word_offset: payload.word_offset ?? null,
    word_length: payload.word_length ?? null,
    translation: payload.translation || null,
  };
  // save_page_url = false → không gửi link và tiêu đề trang (mục 3.4)
  if (!settings || settings.save_page_url !== false) {
    if (/^https?:/i.test(payload.page_url || '')) body.page_url = String(payload.page_url).slice(0, 2048);
    if (payload.page_title) body.page_title = String(payload.page_title).slice(0, 255);
  }
  const data = await api('/words', { method: 'POST', body });
  refreshHighlights().catch(() => {});
  return data;
}

/* ------------------------------------------------------------------ */
/* Đồng bộ định kỳ: cài đặt, danh sách highlight, lịch nhắc (mục 6.3, 8.4) */
/* ------------------------------------------------------------------ */

const REMINDER_ALARM = 'tv-reminder';
const REFRESH_ALARM = 'tv-refresh';
const REFRESH_MINUTES = 6 * 60;

async function refreshAll() {
  if (!(await getAuth())) return { refreshed: false };
  await Promise.allSettled([refreshSettings(), refreshHighlights()]);
  return { refreshed: true };
}

async function refreshSettings() {
  const { settings } = await api('/settings');
  // Giá trị server ghi đè giá trị local (contract mục 6.4)
  await chrome.storage.local.set({
    [SETTINGS_CACHE_KEY]: settings,
    [APPEARANCE_KEY]: validAppearance(settings.appearance),
  });
  await scheduleReminder(settings);
  return settings;
}

async function refreshHighlights() {
  if (!(await getAuth())) return;
  const data = await api('/words/highlight-list');
  await chrome.storage.local.set({
    [HIGHLIGHT_KEY]: { generated_at: data.generated_at, words: data.words || [] },
  });
}

async function scheduleReminder(settings) {
  await chrome.alarms.clear(REMINDER_ALARM);
  if (!settings?.reminder_time || !(settings.reminder_channels || []).includes('browser')) return;
  const when = nextOccurrence(settings.reminder_time, settings.timezone || 'Asia/Ho_Chi_Minh');
  chrome.alarms.create(REMINDER_ALARM, { when, periodInMinutes: 24 * 60 });
}

/** Thời điểm (ms) gần nhất trong tương lai ứng với "HH:MM" theo múi giờ tz. */
function nextOccurrence(hhmm, tz, now = Date.now()) {
  const [h, m] = hhmm.split(':').map(Number);
  const parts = (t) => {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(t));
    const g = (k) => Number(f.find((p) => p.type === k)?.value);
    return { y: g('year'), mo: g('month'), d: g('day'), h: g('hour'), mi: g('minute'), s: g('second') };
  };
  const p = parts(now);
  // Độ lệch múi giờ = giờ địa phương (coi như UTC) − giờ UTC thật
  const offset = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(now / 1000) * 1000;
  let target = Date.UTC(p.y, p.mo - 1, p.d, h, m) - offset;
  if (target <= now + 1000) target += 86400000;
  return target;
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    refreshAll().catch(() => {});
    return;
  }
  if (alarm.name !== REMINDER_ALARM) return;
  try {
    if (!(await getAuth())) return;
    const today = await api('/today');
    if (today.studied || !(today.reminder_channels || []).includes('browser')) return;
    const n = today.due_count;
    chrome.notifications.create('tv-reminder-' + today.date, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'Transaver Word',
      message:
        n > 0
          ? `Có ${n} từ đang chờ bạn ôn hôm nay. Vài phút là xong!`
          : 'Dành vài phút làm quen thêm vài từ mới nhé.',
      priority: 0,
    });
  } catch (_) {
    // mất mạng hoặc hết phiên: bỏ qua lần nhắc này
  }
});

chrome.notifications.onClicked.addListener(async (id) => {
  if (!id.startsWith('tv-reminder')) return;
  chrome.tabs.create({ url: await webAppUrl('/review') });
  chrome.notifications.clear(id);
});

chrome.runtime.onStartup.addListener(() => {
  refreshAll().catch(() => {});
});

chrome.alarms.get(REFRESH_ALARM, (a) => {
  if (!a) chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: REFRESH_MINUTES, delayInMinutes: 1 });
});
