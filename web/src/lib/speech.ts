import type { Word } from '@/api/types';

let current: HTMLAudioElement | null = null;

/** Phát âm một từ: ưu tiên audio_url, không có (hoặc lỗi) thì dùng speechSynthesis của trình duyệt. */
export function speakWord(word: Pick<Word, 'text' | 'audio_url' | 'source_lang'>): void {
  current?.pause();
  if (word.audio_url) {
    const audio = new Audio(word.audio_url);
    current = audio;
    audio.play().catch(() => speakText(word.text, word.source_lang));
    return;
  }
  speakText(word.text, word.source_lang);
}

export function speakText(text: string, lang: string): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
