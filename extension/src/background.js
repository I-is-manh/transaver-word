/**
 * Service worker: nhận yêu cầu dịch từ content script / popup và gọi API dịch.
 * Nhà cung cấp hiện tại: MyMemory (miễn phí, không cần API key, ~5000 lượt/ngày/IP).
 */
importScripts('languages.js');

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'TV_TRANSLATE') return false;
  translate(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
  return true; // giữ kênh mở cho phản hồi bất đồng bộ
});

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
