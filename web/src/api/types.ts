/** Kiểu dữ liệu theo docs/api-contract.md v0.1. Tên trường giữ snake_case như JSON. */

/** Thời điểm ISO 8601 UTC, ví dụ "2026-11-08T14:03:00Z". */
export type IsoDateTime = string;

export type Role = 'user' | 'admin' | 'superadmin';

export const isAdminRole = (role: Role | undefined) => role === 'admin' || role === 'superadmin';

/** Mục 2.1 */
export interface User {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  /** false: tài khoản tạo bằng Google, không có mật khẩu (mục 2.6) */
  has_password: boolean;
  /** Mục 2.7: đã bấm nút xác nhận trong email */
  email_verified: boolean;
  /** Mục 9.1: khác null khi superadmin đang đăng nhập với tư cách user này */
  impersonator: { id: number; email: string } | null;
  timezone: string;
  onboarding_completed: boolean;
  created_at: IsoDateTime;
}

export interface AuthResponse {
  token: string;
  user: User;
}

/** POST /auth/google/exchange (mục 2.6) */
export interface GoogleExchangeResponse extends AuthResponse {
  created: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  password_confirmation: string;
  timezone?: string;
  device_name: DeviceName;
}

export interface LoginRequest {
  email: string;
  password: string;
  device_name: DeviceName;
}

export type DeviceName = 'web' | 'extension';

export type WordKind = 'word' | 'phrase';
export type WordStatus = 'learning' | 'known';
/** 0 mới · 1 đang học · 2 ôn tập · 3 học lại */
export type FsrsState = 0 | 1 | 2 | 3;

/** Mục 3.1 */
export interface Word {
  id: number;
  text: string;
  normalized_text: string;
  kind: WordKind;
  source_lang: string;
  target_lang: string;
  meaning: string | null;
  /** Ghi chú riêng của người dùng, tối đa 1000 ký tự (mục 3.7). */
  note: string | null;
  phonetic: string | null;
  audio_url: string | null;
  part_of_speech: string | null;
  status: WordStatus;
  fsrs_state: FsrsState;
  due_at: IsoDateTime | null;
  is_mastered: boolean;
  lapses: number;
  contexts_count: number;
  /** Deck chứa từ này (giai đoạn 5). */
  deck_ids: number[];
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  deleted_at: IsoDateTime | null;
  /** Ngày lưu theo múi giờ người dùng, YYYY-MM-DD (mục 3.11). */
  saved_date: string;
}

export type MeaningSource = 'translation' | 'dictionary' | 'user' | 'ai';

/** Mục 3.2 */
export interface Context {
  id: number;
  sentence: string;
  word_offset: number | null;
  word_length: number | null;
  page_title: string | null;
  page_url: string | null;
  meaning: string | null;
  meaning_source: MeaningSource | null;
  created_at: IsoDateTime;
}

/** Mục 3.3 */
export interface MeaningCandidate {
  key: string;
  source: 'translation' | 'dictionary';
  part_of_speech: string | null;
  text: string;
  example: string | null;
}

/** Mục 1.5 */
export interface Paginated<T> {
  data: T[];
  links: { first: string | null; last: string | null; prev: string | null; next: string | null };
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

/** Mục 3.4 */
export interface SaveWordRequest {
  text: string;
  source_lang: string;
  target_lang: string;
  sentence: string;
  word_offset?: number | null;
  word_length?: number | null;
  page_title?: string | null;
  page_url?: string | null;
  translation?: string | null;
}

export interface SaveWordResponse {
  word: Word;
  context: Context;
  word_created: boolean;
  context_created: boolean;
  meaning_candidates: MeaningCandidate[];
  new_achievements: Achievement[];
}

export type WordSort = '-created_at' | 'created_at' | 'text' | 'due_at';

/** Mục 3.5 */
export interface WordListParams {
  q?: string;
  status?: WordStatus;
  kind?: WordKind;
  sort?: WordSort;
  deck_id?: number;
  /** 1 = chỉ từ khó */
  hard?: 0 | 1;
  /** source_lang, ví dụ "en", "zh-cn" (mục 3.11) */
  lang?: string;
  /** Khoảng ngày lưu YYYY-MM-DD, tính cả hai đầu (mục 3.11) */
  saved_from?: string;
  saved_to?: string;
  page?: number;
  per_page?: number;
}

/** Mục 3.11 */
export interface WordLanguage {
  lang: string;
  count: number;
}

export type WordGroupBy = 'day' | 'month' | 'year';

export interface WordGroup {
  key: string;
  from: string;
  to: string;
  count: number;
}

export type WordGroupParams = Omit<
  WordListParams,
  'sort' | 'page' | 'per_page' | 'saved_from' | 'saved_to'
> & {
  by: WordGroupBy;
  order?: 'desc' | 'asc';
};

export interface WordDetailResponse {
  word: Word;
  contexts: Context[];
}

/** Mục 3.7 */
export interface UpdateWordRequest {
  /** 1–100 ký tự; đổi chữ giữ nguyên lịch ôn, server tính lại vị trí trong câu. */
  text?: string;
  meaning?: string | null;
  /** Tối đa 1000, null để xóa. */
  note?: string | null;
  status?: WordStatus;
  kind?: WordKind;
}

/** Mục 3.9 */
export interface UpdateContextRequest {
  meaning: string | null;
  meaning_source: 'dictionary' | 'user' | 'translation';
}

/** Mục 4.1 */
export interface DictionaryEntry {
  text: string;
  phonetic: string | null;
  audio_url: string | null;
  meanings: { part_of_speech: string; definition: string; example: string | null }[];
}

/** Mục 1.4: body lỗi 422 */
export interface ValidationErrorBody {
  message: string;
  errors: Record<string, string[]>;
}

// ---------------------------------------------------------------- Ôn tập (mục 5)

export type ExerciseType = 'flashcard' | 'mcq' | 'cloze' | 'listening' | 'dictation';
/** 1 Quên · 2 Khó · 3 Được · 4 Dễ */
export type Rating = 1 | 2 | 3 | 4;
export type ReviewMode = 'daily' | 'hard' | 'deck';

export interface CardOption {
  key: string;
  text: string;
}

/** Mục 5.2 */
export interface Card {
  card_id: string;
  word: Word;
  exercise_type: ExerciseType;
  context: Context | null;
  cloze: { before: string; after: string; hint: string | null } | null;
  options: CardOption[] | null;
  answer_key: string | null;
  answer_text: string | null;
  /** Số giây tới lần ôn tiếp theo từng mức rating */
  intervals: Record<'1' | '2' | '3' | '4', number>;
}

export interface ReviewSession {
  id: number;
  mode: ReviewMode;
  deck_id: number | null;
  started_at: IsoDateTime;
}

/** Mục 5.3 */
export interface StartSessionRequest {
  mode: ReviewMode;
  deck_id: number | null;
}

export interface StartSessionResponse {
  session: ReviewSession;
  cards: Card[];
  overload: boolean;
}

/** Mục 5.4 */
export interface AnswerRequest {
  client_uuid: string;
  session_id: number;
  user_word_id: number;
  exercise_type: ExerciseType;
  rating: Rating;
  is_correct: boolean | null;
  answer: string | null;
  word_context_id: number | null;
}

export interface AnswerResponse {
  word: Word;
  next_due_at: IsoDateTime | null;
  xp_earned: number;
  became_mastered: boolean;
  today: DailyProgress;
  streak: Streak;
  new_achievements: Achievement[];
}

/** Mục 5.5 */
export interface SessionSummary {
  cards_reviewed: number;
  correct_count: number;
  new_cards: number;
  xp_earned: number;
  duration_seconds: number;
  newly_mastered: number;
}

export interface FinishSessionResponse {
  summary: SessionSummary;
  today: DailyProgress;
  streak: Streak;
  xp: Xp;
  /** Không có trong ví dụ của contract nhưng mục 8.1 nói kiểm tra huy hiệu khi kết thúc buổi. */
  new_achievements?: Achievement[];
}

/** Mục 5.6 */
export interface DailyProgress {
  date: string;
  reviews_count: number;
  new_words_learned: number;
  words_saved: number;
  xp_earned: number;
  goal_new_words: number;
  due_remaining: number;
  goal_met: boolean;
}

export interface Streak {
  current: number;
  longest: number;
  freezes_available: number;
  last_active_date: string | null;
  today_done: boolean;
}

export interface Xp {
  total: number;
  level: number;
  level_progress: number;
  xp_to_next_level: number;
}

// ---------------------------------------------------------------- Cài đặt (mục 6)

export type ReminderChannel = 'browser' | 'email';

/** Mục 6.4 */
export type Appearance = 'system' | 'light' | 'dark';

export interface CardDisplay {
  phonetic: boolean;
  english_definition: boolean;
  context_sentence: boolean;
}

/** Mục 6.1 */
export interface Settings {
  timezone: string;
  daily_new_words: number;
  reminder_time: string | null;
  reminder_channels: ReminderChannel[];
  exercise_types: ExerciseType[];
  save_page_url: boolean;
  daily_review_limit: number;
  desired_retention: number;
  card_display: CardDisplay;
  weekly_report: boolean;
  appearance: Appearance;
}

export type OnboardingGoal = 'exam' | 'work' | 'travel' | 'hobby';
export type OnboardingLevel = 'beginner' | 'intermediate' | 'advanced';

export interface OnboardingRequest {
  goal: OnboardingGoal;
  level: OnboardingLevel;
  daily_minutes: 5 | 10 | 20;
}

export interface StatsSummary {
  saved_count: number;
  learning_count: number;
  known_count: number;
  mastered_count: number;
  hard_count: number;
  due_today: number;
  new_available_today: number;
  today: DailyProgress;
  streak: Streak;
  xp: Xp;
}

export interface Today {
  date: string;
  studied: boolean;
  due_count: number;
  reminder_time: string | null;
  reminder_channels: ReminderChannel[];
}

// ---------------------------------------------------------------- Deck (mục 7)

export interface Deck {
  id: number;
  name: string;
  color: string | null;
  words_count: number;
  due_count: number;
  created_at: IsoDateTime;
}

// ---------------------------------------------------------------- Động lực (mục 8)

export interface Achievement {
  code: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
  earned_at: IsoDateTime | null;
}

export interface WeeklyReport {
  week_start: string;
  week_end: string;
  days_active: number;
  reviews_count: number;
  words_saved: number;
  newly_mastered: number;
  mastered_total: number;
  /** null khi không có lượt ôn nào (v0.8) */
  accuracy: number | null;
  xp_earned: number;
  previous: {
    days_active: number;
    reviews_count: number;
    words_saved: number;
    newly_mastered: number;
    accuracy: number | null;
  };
}

export interface HeatmapDay {
  date: string;
  reviews_count: number;
  words_saved: number;
  freeze_used: boolean;
}

export interface ProgressPoint {
  date: string;
  saved_total: number;
  mastered_total: number;
  reviews_count: number;
}

export interface HighlightWord {
  id: number;
  text: string;
  normalized_text: string;
  kind: WordKind;
  meaning: string | null;
}

// ---------------------------------------------------------------- Admin (mục 9)

export interface AdminStats {
  users_total: number;
  users_active_7d: number;
  words_total: number;
  reviews_today: number;
  reviews_7d: number;
}

export interface AdminUser {
  id: number;
  email: string;
  role: Role;
  status: 'active' | 'banned';
  created_at: IsoDateTime;
  words_count: number;
  last_active_date: string | null;
}

/** Mục 9.1 */
export interface ImpersonateResponse {
  token: string;
  user: User;
  expires_at: IsoDateTime;
}

export interface ImpersonationLog {
  id: number;
  impersonator_email: string;
  user_email: string;
  started_at: IsoDateTime;
  ended_at: IsoDateTime | null;
}
