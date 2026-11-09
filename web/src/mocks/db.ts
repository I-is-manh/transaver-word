/**
 * Dữ liệu giả cho MSW theo docs/api-contract.md v0.3. Chỉ dùng khi VITE_USE_MOCKS=true.
 * Lưu vào localStorage để tải lại trang không mất dữ liệu. Xóa: window.__tvResetMocks().
 *
 * FSRS ở đây là bản giản lược đủ để giao diện có số liệu hợp lý, KHÔNG phải thuật toán thật.
 */
import type {
  Achievement,
  Context,
  DailyProgress,
  ExerciseType,
  Rating,
  Settings,
  Streak,
  User,
  Word,
  Xp,
} from '@/api/types';

export interface MockUser extends Omit<User, 'impersonator' | 'has_password' | 'email_verified'> {
  password: string;
  status: 'active' | 'banned';
}

/** Token impersonate (mục 9.1): hết hạn sau 2 giờ */
export interface MockImpersonation {
  user_id: number;
  impersonator_id: number;
  expires_at: string;
  log_id: number;
}

export interface MockImpersonationLog {
  id: number;
  impersonator_id: number;
  user_id: number;
  started_at: string;
  ended_at: string | null;
}

export interface MockDictEntry {
  phonetic: string | null;
  audio_url: string | null;
  meanings: { part_of_speech: string; definition: string; example: string | null }[];
}

export type MockWord = Omit<Word, 'deck_ids' | 'saved_date'> & {
  user_id: number;
  stability: number;
  last_review_at: string | null;
  mastered_at: string | null;
};

export type MockContext = Context & { word_id: number; last_used_at: string | null };

export interface MockActivity {
  reviews_count: number;
  new_words_learned: number;
  words_saved: number;
  xp_earned: number;
  freeze_used: boolean;
  correct_count: number;
}

export interface MockSession {
  id: number;
  user_id: number;
  mode: 'daily' | 'hard' | 'deck';
  deck_id: number | null;
  started_at: string;
  ended_at: string | null;
  cards_reviewed: number;
  correct_count: number;
  new_cards: number;
  xp_earned: number;
  newly_mastered: number;
  had_again: boolean;
}

export interface MockLog {
  client_uuid: string;
  user_id: number;
  word_id: number;
  rating: Rating;
  exercise_type: ExerciseType;
  date: string;
  created_at: string;
  response: unknown;
}

export interface MockStreak {
  current: number;
  longest: number;
  freezes_available: number;
  last_active_date: string | null;
  /** Số ngày liên tiếp kể từ lần cuối được tặng thẻ đóng băng */
  since_freeze: number;
}

export interface MockState {
  seq: {
    user: number;
    word: number;
    context: number;
    token: number;
    session: number;
    deck: number;
    impersonationLog: number;
  };
  users: MockUser[];
  tokens: Record<string, number>;
  impersonations: Record<string, MockImpersonation>;
  impersonationLogs: MockImpersonationLog[];
  words: MockWord[];
  contexts: MockContext[];
  settings: Record<number, Settings>;
  /** Trường cài đặt người dùng tự sửa (source = "user"), onboarding không ghi đè */
  userSetFields: Record<number, string[]>;
  activity: Record<number, Record<string, MockActivity>>;
  streaks: Record<number, MockStreak>;
  xp: Record<number, number>;
  sessions: MockSession[];
  logs: MockLog[];
  decks: { id: number; user_id: number; name: string; color: string | null; created_at: string }[];
  deckWords: { deck_id: number; word_id: number }[];
  earned: Record<number, Record<string, string>>;
}

const KEY = 'tv.mock.db.v5';

export const HARD_LAPSES = 3;
export const FREEZE_EVERY_DAYS = 7;
export const MAX_FREEZES = 2;

export const DICTIONARY: Record<string, MockDictEntry> = {
  ephemeral: {
    phonetic: '/ɪˈfem(ə)rəl/',
    audio_url: 'https://api.dictionaryapi.dev/media/pronunciations/en/ephemeral-us.mp3',
    meanings: [
      {
        part_of_speech: 'adjective',
        definition: 'Lasting for a very short time.',
        example: 'fashions are ephemeral',
      },
      {
        part_of_speech: 'noun',
        definition: 'A thing that is valuable or important only for a short time.',
        example: null,
      },
    ],
  },
  serendipity: {
    phonetic: '/ˌsɛɹ.ənˈdɪp.ɪ.ti/',
    audio_url: null,
    meanings: [
      {
        part_of_speech: 'noun',
        definition: 'The occurrence of events by chance in a happy or beneficial way.',
        example: 'a fortunate stroke of serendipity',
      },
    ],
  },
  resilient: {
    phonetic: '/rɪˈzɪliənt/',
    audio_url: null,
    meanings: [
      {
        part_of_speech: 'adjective',
        definition: 'Able to recover quickly from difficult conditions.',
        example: 'babies are generally far more resilient than new parents realize',
      },
    ],
  },
  ubiquitous: {
    phonetic: '/juːˈbɪkwɪtəs/',
    audio_url: null,
    meanings: [
      {
        part_of_speech: 'adjective',
        definition: 'Present, appearing, or found everywhere.',
        example: 'his ubiquitous influence was felt by all',
      },
    ],
  },
  meticulous: {
    phonetic: '/məˈtɪkjələs/',
    audio_url: null,
    meanings: [
      {
        part_of_speech: 'adjective',
        definition: 'Showing great attention to detail; very careful and precise.',
        example: 'he had always been so meticulous about his appearance',
      },
    ],
  },
};

export const ACHIEVEMENTS: (Omit<Achievement, 'earned_at'> & { hidden: boolean })[] = [
  {
    code: 'first_save',
    name: 'Từ đầu tiên',
    description: 'Lưu 1 từ',
    icon: 'save',
    xp_reward: 10,
    hidden: false,
  },
  {
    code: 'first_review',
    name: 'Buổi ôn đầu tiên',
    description: 'Hoàn thành 1 buổi ôn',
    icon: 'review',
    xp_reward: 10,
    hidden: false,
  },
  {
    code: 'streak_7',
    name: 'Một tuần bền bỉ',
    description: 'Streak 7 ngày',
    icon: 'streak',
    xp_reward: 50,
    hidden: false,
  },
  {
    code: 'streak_30',
    name: 'Một tháng bền bỉ',
    description: 'Streak 30 ngày',
    icon: 'streak',
    xp_reward: 200,
    hidden: false,
  },
  {
    code: 'mastered_50',
    name: '50 từ vững',
    description: '50 từ đã thuộc',
    icon: 'badge',
    xp_reward: 100,
    hidden: false,
  },
  {
    code: 'mastered_250',
    name: '250 từ vững',
    description: '250 từ đã thuộc',
    icon: 'badge',
    xp_reward: 300,
    hidden: false,
  },
  {
    code: 'sites_10',
    name: 'Người đọc rộng',
    description: 'Lưu từ từ 10 trang web khác nhau',
    icon: 'context',
    xp_reward: 50,
    hidden: true,
  },
  {
    code: 'perfect_session',
    name: 'Không sai câu nào',
    description: 'Một buổi ôn từ 10 thẻ không có lần "Quên"',
    icon: 'check',
    xp_reward: 30,
    hidden: true,
  },
  {
    code: 'comeback',
    name: 'Trở lại',
    description: 'Ôn lại sau ít nhất 7 ngày nghỉ',
    icon: 'calendar',
    xp_reward: 20,
    hidden: true,
  },
];

export const DEFAULT_SETTINGS = (timezone: string): Settings => ({
  timezone,
  daily_new_words: 7,
  reminder_time: '21:00',
  reminder_channels: ['browser'],
  exercise_types: ['flashcard', 'mcq', 'cloze'],
  save_page_url: true,
  daily_review_limit: 150,
  desired_retention: 0.9,
  card_display: { phonetic: true, english_definition: false, context_sentence: true },
  weekly_report: true,
  appearance: 'system',
});

// ---------------------------------------------------------------- thời gian

export const nowIso = () => toIso(new Date());
export const toIso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
const DAY = 86400000;

/** Ngày YYYY-MM-DD của thời điểm `d` theo múi giờ `tz`. */
export function localDate(tz: string, d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  return new Date(d.getTime() + n * DAY).toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round(
    (new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / DAY,
  );
}

/** Cuối ngày hôm nay theo múi giờ (xấp xỉ: thời điểm hiện tại + phần còn lại của ngày). */
export function endOfToday(tz: string): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const elapsed = (get('hour') * 3600 + get('minute') * 60 + get('second')) * 1000;
  return new Date(now.getTime() - elapsed + DAY - 1000);
}

// ---------------------------------------------------------------- FSRS giản lược

export function intervalsFor(
  w: MockWord,
  retention: number,
): Record<'1' | '2' | '3' | '4', number> {
  // Mức ghi nhớ cao hơn → khoảng cách ngắn hơn
  const k = Math.log(retention) / Math.log(0.9);
  const days = (x: number) => Math.max(1, Math.round(x / k)) * 86400;
  if (w.fsrs_state === 0) return { '1': 60, '2': 360, '3': 86400, '4': days(3) };
  if (w.fsrs_state === 1 || w.fsrs_state === 3)
    return {
      '1': 300,
      '2': 600,
      '3': days(Math.max(1, w.stability)),
      '4': days(Math.max(3, w.stability * 2)),
    };
  const s = w.stability;
  return {
    '1': 600,
    '2': days(Math.max(1, s * 1.2)),
    '3': days(Math.max(2, s * 2.5)),
    '4': days(Math.max(4, s * 4)),
  };
}

export function applyRating(w: MockWord, rating: Rating, retention: number) {
  const iv = intervalsFor(w, retention)[String(rating) as '1'];
  const wasNew = w.fsrs_state === 0;
  if (rating === 1) {
    if (w.fsrs_state === 2) w.lapses += 1;
    w.stability = Math.max(0.3, w.stability * 0.3);
    w.fsrs_state = w.fsrs_state === 0 ? 1 : 3;
  } else {
    w.stability = Math.max(w.stability, iv / 86400);
    w.fsrs_state = iv >= 86400 ? 2 : 1;
  }
  const now = new Date();
  w.due_at = toIso(new Date(now.getTime() + iv * 1000));
  w.last_review_at = toIso(now);
  w.updated_at = toIso(now);
  const mastered = w.fsrs_state === 2 && w.stability >= 21;
  const becameMastered = mastered && !w.mastered_at;
  w.is_mastered = mastered;
  if (becameMastered) w.mastered_at = toIso(now);
  return { wasNew, becameMastered };
}

// ---------------------------------------------------------------- XP, streak, tiến độ

export const levelNeed = (n: number) => 50 * n * (n - 1);

export function xpOf(total: number): Xp {
  let level = 1;
  while (levelNeed(level + 1) <= total) level += 1;
  const base = levelNeed(level);
  const next = levelNeed(level + 1);
  return {
    total,
    level,
    level_progress: Math.round(((total - base) / (next - base)) * 100) / 100,
    xp_to_next_level: next - total,
  };
}

export function emptyActivity(): MockActivity {
  return {
    reviews_count: 0,
    new_words_learned: 0,
    words_saved: 0,
    xp_earned: 0,
    freeze_used: false,
    correct_count: 0,
  };
}

export function activityOf(state: MockState, userId: number, date: string): MockActivity {
  const map = (state.activity[userId] ??= {});
  return (map[date] ??= emptyActivity());
}

export function userTz(state: MockState, userId: number): string {
  return state.users.find((u) => u.id === userId)?.timezone ?? 'Asia/Ho_Chi_Minh';
}

/** Streak để hiển thị: áp luật bỏ lỡ ngày nhưng không ghi lại (ghi khi trả lời thẻ). */
export function streakView(state: MockState, userId: number): Streak {
  const s = state.streaks[userId] ?? emptyStreak();
  const today = localDate(userTz(state, userId));
  let current = s.current;
  let freezes = s.freezes_available;
  if (s.last_active_date && s.last_active_date !== today) {
    const missed = diffDays(today, s.last_active_date) - 1;
    if (missed > freezes) current = 0;
    else freezes -= Math.max(0, missed);
  }
  return {
    current,
    longest: s.longest,
    freezes_available: freezes,
    last_active_date: s.last_active_date,
    today_done: s.last_active_date === today,
  };
}

export function emptyStreak(): MockStreak {
  return { current: 0, longest: 0, freezes_available: 0, last_active_date: null, since_freeze: 0 };
}

/** Ghi nhận một ngày học: gọi khi trả lời thẻ. Trả về true nếu đây là lượt đầu tiên hôm nay. */
export function touchStreak(state: MockState, userId: number): { comeback: boolean } {
  const s = (state.streaks[userId] ??= emptyStreak());
  const today = localDate(userTz(state, userId));
  if (s.last_active_date === today) return { comeback: false };
  let comeback = false;
  if (!s.last_active_date) {
    s.current = 1;
    s.since_freeze = 1;
  } else {
    const gap = diffDays(today, s.last_active_date);
    const missed = gap - 1;
    comeback = gap >= 8;
    if (missed <= 0) {
      s.current += 1;
      s.since_freeze += 1;
    } else if (missed <= s.freezes_available) {
      for (let i = 1; i <= missed; i++) {
        activityOf(state, userId, addDays(s.last_active_date, i)).freeze_used = true;
      }
      s.freezes_available -= missed;
      s.current += 1;
      s.since_freeze += 1;
    } else {
      s.current = 1;
      s.since_freeze = 1;
    }
  }
  if (s.since_freeze >= FREEZE_EVERY_DAYS) {
    s.since_freeze = 0;
    s.freezes_available = Math.min(MAX_FREEZES, s.freezes_available + 1);
  }
  s.longest = Math.max(s.longest, s.current);
  s.last_active_date = today;
  return { comeback };
}

export function isDue(w: MockWord, end: Date): boolean {
  return w.status === 'learning' && !!w.due_at && new Date(w.due_at) <= end;
}

export function dailyProgress(state: MockState, userId: number): DailyProgress {
  const tz = userTz(state, userId);
  const today = localDate(tz);
  const a = activityOf(state, userId, today);
  const settings = state.settings[userId] ?? DEFAULT_SETTINGS(tz);
  const end = endOfToday(tz);
  const words = state.words.filter((w) => w.user_id === userId && !w.deleted_at);
  const dueAll = words.filter((w) => isDue(w, end)).length;
  const due = Math.min(dueAll, settings.daily_review_limit);
  const newAvailable = words.filter((w) => w.status === 'learning' && w.fsrs_state === 0).length;
  const goalNew = settings.daily_new_words;
  return {
    date: today,
    reviews_count: a.reviews_count,
    new_words_learned: a.new_words_learned,
    words_saved: a.words_saved,
    xp_earned: a.xp_earned,
    goal_new_words: goalNew,
    due_remaining: due,
    // v0.5: có ≥ 1 lượt ôn, VÀ (hết từ đến hạn hoặc đã chạm giới hạn ôn), VÀ học đủ từ mới (hoặc hết từ mới)
    goal_met:
      a.reviews_count >= 1 &&
      (due === 0 || a.reviews_count >= settings.daily_review_limit) &&
      (a.new_words_learned >= goalNew || newAvailable === 0),
  };
}

export function addXp(state: MockState, userId: number, amount: number) {
  if (amount <= 0) return;
  state.xp[userId] = (state.xp[userId] ?? 0) + amount;
  activityOf(state, userId, localDate(userTz(state, userId))).xp_earned += amount;
}

/** Kiểm tra huy hiệu, cộng XP thưởng, trả về huy hiệu mới đạt. */
export function checkAchievements(
  state: MockState,
  userId: number,
  extra: { perfectSession?: boolean; comeback?: boolean; sessionFinished?: boolean } = {},
): Achievement[] {
  const earned = (state.earned[userId] ??= {});
  const words = state.words.filter((w) => w.user_id === userId && !w.deleted_at);
  const mastered = words.filter((w) => w.is_mastered).length;
  const streak = state.streaks[userId]?.current ?? 0;
  const hosts = new Set(
    state.contexts
      .filter((c) => words.some((w) => w.id === c.word_id) && c.page_url)
      .map((c) => {
        try {
          return new URL(c.page_url!).host;
        } catch {
          return '';
        }
      })
      .filter(Boolean),
  );
  const finishedSessions = state.sessions.filter((s) => s.user_id === userId && s.ended_at).length;
  const ok: Record<string, boolean> = {
    first_save: words.length >= 1,
    first_review: finishedSessions >= 1 || !!extra.sessionFinished,
    streak_7: streak >= 7,
    streak_30: streak >= 30,
    mastered_50: mastered >= 50,
    mastered_250: mastered >= 250,
    sites_10: hosts.size >= 10,
    perfect_session: !!extra.perfectSession,
    comeback: !!extra.comeback,
  };
  const fresh: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (earned[a.code] || !ok[a.code]) continue;
    const at = nowIso();
    earned[a.code] = at;
    addXp(state, userId, a.xp_reward);
    fresh.push(achievementView(a, at));
  }
  return fresh;
}

export function achievementView(
  a: (typeof ACHIEVEMENTS)[number],
  earnedAt: string | null,
): Achievement {
  return {
    code: a.code,
    name: a.name,
    description: a.description,
    icon: a.icon,
    xp_reward: a.xp_reward,
    earned_at: earnedAt,
  };
}

// ---------------------------------------------------------------- tạo dữ liệu

export function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function makeWord(
  state: MockState,
  userId: number,
  text: string,
  source: string,
  target: string,
  createdAt = nowIso(),
): MockWord {
  const normalized = normalize(text);
  const dict = source === 'en' ? DICTIONARY[normalized] : undefined;
  const word: MockWord = {
    id: ++state.seq.word,
    user_id: userId,
    text: text.trim(),
    normalized_text: normalized,
    kind: normalized.includes(' ') ? 'phrase' : 'word',
    source_lang: source,
    target_lang: target,
    meaning: null,
    note: null,
    phonetic: dict?.phonetic ?? null,
    audio_url: dict?.audio_url ?? null,
    part_of_speech: dict?.meanings[0]?.part_of_speech ?? null,
    status: 'learning',
    fsrs_state: 0,
    due_at: null,
    is_mastered: false,
    lapses: 0,
    contexts_count: 0,
    created_at: createdAt,
    updated_at: createdAt,
    deleted_at: null,
    stability: 0,
    last_review_at: null,
    mastered_at: null,
  };
  state.words.push(word);
  return word;
}

export function makeContext(
  state: MockState,
  word: MockWord,
  data: Omit<Context, 'id' | 'created_at'>,
  createdAt = nowIso(),
): MockContext {
  const ctx: MockContext = {
    ...data,
    id: ++state.seq.context,
    word_id: word.id,
    created_at: createdAt,
    last_used_at: null,
  };
  state.contexts.push(ctx);
  word.contexts_count += 1;
  return ctx;
}

const SAMPLE_WORDS: [string, string | null, string, string][] = [
  [
    'ephemeral',
    'ngắn ngủi, phù du',
    'Fame in the age of social media is ephemeral.',
    'theatlantic.com',
  ],
  ['serendipity', 'sự tình cờ may mắn', 'Finding that café was pure serendipity.', 'nytimes.com'],
  ['resilient', 'kiên cường, mau phục hồi', 'Children are remarkably resilient.', 'bbc.com'],
  [
    'ubiquitous',
    'có mặt khắp nơi',
    'Smartphones have become ubiquitous in daily life.',
    'wired.com',
  ],
  ['take for granted', 'coi là hiển nhiên', 'We often take our health for granted.', 'medium.com'],
  [
    'meticulous',
    'tỉ mỉ, kỹ lưỡng',
    'She kept meticulous records of every experiment.',
    'nature.com',
  ],
  ['ambiguous', 'mơ hồ, nước đôi', 'The wording of the contract is ambiguous.', 'reuters.com'],
  ['candid', 'thẳng thắn', 'He gave a candid interview about his failures.', 'theguardian.com'],
  [
    'diligent',
    'siêng năng, cần cù',
    'Diligent students review a little every day.',
    'edutopia.org',
  ],
  [
    'eloquent',
    'hùng hồn, có tài ăn nói',
    'Her eloquent speech moved the whole audience.',
    'npr.org',
  ],
  ['frugal', 'tằn tiện, tiết kiệm', 'They lived a frugal life to save for a house.', 'forbes.com'],
  [
    'gregarious',
    'thích giao du',
    'Dolphins are gregarious animals that live in groups.',
    'nationalgeographic.com',
  ],
  ['inevitable', 'không thể tránh khỏi', 'Change is inevitable in any growing company.', 'hbr.org'],
  [
    'lucid',
    'sáng sủa, dễ hiểu',
    'The author gives a lucid explanation of the theory.',
    'economist.com',
  ],
  ['mitigate', 'giảm nhẹ', 'Planting trees can help mitigate climate change.', 'bbc.com'],
  ['nuance', 'sắc thái', 'Machine translation often misses the nuance of a phrase.', 'wired.com'],
  ['obsolete', 'lỗi thời', 'Fax machines are almost obsolete.', 'theverge.com'],
  ['pragmatic', 'thực dụng, thực tế', 'We need a pragmatic approach to this problem.', 'hbr.org'],
  ['reluctant', 'miễn cưỡng', 'He was reluctant to share his password.', 'nytimes.com'],
  ['scrutiny', 'sự xem xét kỹ', 'The new policy is under public scrutiny.', 'reuters.com'],
  ['tenacious', 'bền bỉ, ngoan cường', 'A tenacious learner never skips practice.', 'medium.com'],
  ['versatile', 'đa năng', 'Olive oil is a versatile ingredient.', 'seriouseats.com'],
  ['look forward to', 'mong chờ', 'I look forward to hearing from you.', 'gmail.com'],
  ['wary', 'thận trọng, dè chừng', 'Be wary of emails asking for your password.', 'theverge.com'],
  ['zealous', 'nhiệt thành', 'The zealous volunteers worked all night.', 'npr.org'],
  ['benevolent', null, 'The old king was a benevolent ruler.', 'britannica.com'],
];

/** [chữ, source_lang, nghĩa, câu, số giờ trước] */
const EXTRA_WORDS: [string, string, string, string, number][] = [
  ['学习', 'zh-cn', 'học tập', '我每天都在学习中文。', 1],
  ['朋友', 'zh-cn', 'bạn bè', '他是我最好的朋友。', 2],
  ['ありがとう', 'ja', 'cảm ơn', '手伝ってくれてありがとう。', 3],
  ['curious', 'en', 'tò mò', 'Cats are naturally curious.', 4],
  ['勉強', 'ja', 'học, việc học', '毎日日本語を勉強します。', 26],
  ['咖啡', 'zh-cn', 'cà phê', '我想喝一杯咖啡。', 27],
  ['inspire', 'en', 'truyền cảm hứng', 'Good teachers inspire their students.', 28],
  ['旅行', 'ja', 'du lịch', '来月京都へ旅行します。', 75],
  ['天气', 'zh-cn', 'thời tiết', '今天天气很好。', 76],
  ['thrive', 'en', 'phát triển mạnh', 'Some plants thrive in the shade.', 100],
  ['candor', 'en', 'sự thẳng thắn', 'I appreciate your candor.', 24 * 95],
  ['電車', 'ja', 'tàu điện', '電車が遅れています。', 24 * 100],
  ['endeavor', 'en', 'nỗ lực', 'Learning a language is a long endeavor.', 24 * 130],
  ['图书馆', 'zh-cn', 'thư viện', '我在图书馆看书。', 24 * 380],
  ['perseverance', 'en', 'sự kiên trì', 'Perseverance is the key to success.', 24 * 400],
  ['桜', 'ja', 'hoa anh đào', '桜が咲きました。', 24 * 420],
  ['quaint', 'en', 'cổ kính, lạ mắt', 'We stayed in a quaint village.', 24 * 760],
  ['opportunity', 'en', 'cơ hội', 'This is a great opportunity.', 24 * 800],
];

function seed(): MockState {
  const state: MockState = {
    seq: { user: 0, word: 0, context: 0, token: 0, session: 0, deck: 0, impersonationLog: 0 },
    users: [],
    tokens: {},
    impersonations: {},
    impersonationLogs: [],
    words: [],
    contexts: [],
    settings: {},
    userSetFields: {},
    activity: {},
    streaks: {},
    xp: {},
    sessions: [],
    logs: [],
    decks: [],
    deckWords: [],
    earned: {},
  };
  const tz = 'Asia/Ho_Chi_Minh';
  const mkUser = (
    email: string,
    role: 'user' | 'admin' | 'superadmin',
    daysAgo: number,
    done = true,
  ) => {
    const u: MockUser = {
      id: ++state.seq.user,
      email,
      password: 'matkhau123',
      name: null,
      role,
      timezone: tz,
      onboarding_completed: done,
      created_at: toIso(new Date(Date.now() - daysAgo * DAY)),
      status: 'active',
    };
    state.users.push(u);
    state.settings[u.id] = DEFAULT_SETTINGS(tz);
    state.userSetFields[u.id] = [];
    state.streaks[u.id] = emptyStreak();
    state.xp[u.id] = 0;
    return u;
  };

  const demo = mkUser('demo@transaver.vn', 'user', 70);
  mkUser('admin@transaver.vn', 'admin', 90);
  mkUser('superadmin@transaver.vn', 'superadmin', 120);
  for (let i = 1; i <= 6; i++) mkUser(`hocvien${i}@example.com`, 'user', i * 9, i % 2 === 0);

  // Từ của demo: rải đều 60 ngày, trạng thái học khác nhau
  const today = localDate(tz);
  SAMPLE_WORDS.forEach(([text, meaning, sentence, host], i) => {
    const ago = 58 - i * 2;
    const created = toIso(new Date(Date.now() - ago * DAY));
    const w = makeWord(state, demo.id, text, 'en', 'vi', created);
    w.meaning = meaning ?? null;
    const off = sentence.toLowerCase().indexOf(text.split(' ')[0]!);
    makeContext(
      state,
      w,
      {
        sentence,
        word_offset: off >= 0 ? off : null,
        word_length: off >= 0 ? text.split(' ')[0]!.length : null,
        page_title: `Bài viết trên ${host}`,
        page_url: `https://${host}/article/${w.normalized_text.replace(/\s+/g, '-')}`,
        meaning: meaning ?? null,
        meaning_source: meaning ? 'translation' : null,
      },
      created,
    );
    if (i < 6) {
      // đã thuộc
      w.fsrs_state = 2;
      w.stability = 25 + i;
      w.is_mastered = true;
      w.mastered_at = toIso(new Date(Date.now() - (20 - i) * DAY));
      w.due_at = toIso(new Date(Date.now() + (5 + i) * DAY));
    } else if (i < 14) {
      // đang ôn, một phần đến hạn hôm nay
      w.fsrs_state = 2;
      w.stability = 3 + i;
      w.due_at = toIso(new Date(Date.now() + (i % 3 === 0 ? -DAY / 2 : (i % 4) * DAY)));
      if (i === 7 || i === 9) w.lapses = 3;
    } else if (i < 17) {
      w.fsrs_state = 3;
      w.stability = 0.5;
      w.lapses = i === 15 ? 4 : 1;
      w.due_at = toIso(new Date(Date.now() - 3600 * 1000));
    }
    if (i === 3) w.status = 'known';
    w.last_review_at = w.fsrs_state ? toIso(new Date(Date.now() - 2 * DAY)) : null;
  });

  // Từ nhiều ngôn ngữ và trải nhiều ngày/tháng/năm (để thử gom nhóm, mục 3.11)
  EXTRA_WORDS.forEach(([text, lang, meaning, sentence, hoursAgo]) => {
    const created = toIso(new Date(Date.now() - hoursAgo * 3600 * 1000));
    const w = makeWord(state, demo.id, text, lang, 'vi', created);
    w.meaning = meaning;
    const off = sentence.indexOf(text);
    makeContext(
      state,
      w,
      {
        sentence,
        word_offset: off >= 0 ? off : null,
        word_length: off >= 0 ? text.length : null,
        page_title: null,
        page_url: null,
        meaning,
        meaning_source: 'translation',
      },
      created,
    );
  });

  // Hoạt động 60 ngày: nghỉ vài ngày, streak hiện tại 5
  for (let d = 60; d >= 1; d--) {
    const date = addDays(today, -d);
    if (d > 5 && (d % 6 === 0 || d % 11 === 0)) continue;
    const a = activityOf(state, demo.id, date);
    a.reviews_count = 5 + ((d * 7) % 23);
    a.correct_count = Math.round(a.reviews_count * 0.85);
    a.new_words_learned = d % 3;
    a.words_saved = d % 2 === 0 ? 1 : 0;
    a.xp_earned = a.correct_count * 10;
    state.xp[demo.id]! += a.xp_earned;
  }
  activityOf(state, demo.id, addDays(today, -3)).freeze_used = true;
  activityOf(state, demo.id, addDays(today, -3)).reviews_count = 0;
  state.streaks[demo.id] = {
    current: 5,
    longest: 12,
    freezes_available: 1,
    last_active_date: addDays(today, -1),
    since_freeze: 5,
  };
  state.earned[demo.id] = {
    first_save: toIso(new Date(Date.now() - 58 * DAY)),
    first_review: toIso(new Date(Date.now() - 57 * DAY)),
    streak_7: toIso(new Date(Date.now() - 30 * DAY)),
  };

  // Deck mẫu
  const deck = {
    id: ++state.seq.deck,
    user_id: demo.id,
    name: 'IELTS Writing',
    color: null,
    created_at: nowIso(),
  };
  state.decks.push(deck);
  state.words
    .filter((w) => w.user_id === demo.id)
    .slice(6, 12)
    .forEach((w) => state.deckWords.push({ deck_id: deck.id, word_id: w.id }));

  // Vài từ cho người dùng khác (cho trang admin)
  state.users.slice(2).forEach((u, i) => {
    for (let k = 0; k <= i; k++) makeWord(state, u.id, `sample${u.id}x${k}`, 'en', 'vi');
    if (i % 2 === 0) activityOf(state, u.id, addDays(today, -i)).reviews_count = 3 + i;
  });
  return state;
}

// ---------------------------------------------------------------- lưu trữ

let cache: MockState | null = null;

export function db(): MockState {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) cache = JSON.parse(raw) as MockState;
  } catch {
    cache = null;
  }
  if (!cache) {
    cache = seed();
    persist();
  }
  return cache;
}

export function persist(): void {
  try {
    if (cache) localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Không lưu được thì dữ liệu chỉ sống trong phiên này.
  }
}

/** Cho token impersonate hết hạn ngay để thử luồng 401: window.__tvExpireImpersonation() */
export function expireImpersonations(): void {
  const state = db();
  for (const imp of Object.values(state.impersonations)) imp.expires_at = new Date(0).toISOString();
  persist();
}

export function resetDb(): void {
  cache = seed();
  persist();
}

// ---------------------------------------------------------------- chuyển sang dạng API

export function publicUser(u: MockUser, impersonator: User['impersonator'] = null): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    has_password: true,
    email_verified: true,
    impersonator,
    timezone: u.timezone,
    onboarding_completed: u.onboarding_completed,
    created_at: u.created_at,
  };
}

export function publicWord(state: MockState, w: MockWord): Word {
  return {
    id: w.id,
    text: w.text,
    normalized_text: w.normalized_text,
    kind: w.kind,
    source_lang: w.source_lang,
    target_lang: w.target_lang,
    meaning: w.meaning,
    // dữ liệu mock cũ trong localStorage chưa có note
    note: w.note ?? null,
    phonetic: w.phonetic,
    audio_url: w.audio_url,
    part_of_speech: w.part_of_speech,
    status: w.status,
    fsrs_state: w.fsrs_state,
    due_at: w.due_at,
    is_mastered: w.is_mastered,
    lapses: w.lapses,
    contexts_count: w.contexts_count,
    deck_ids: state.deckWords.filter((d) => d.word_id === w.id).map((d) => d.deck_id),
    created_at: w.created_at,
    updated_at: w.updated_at,
    deleted_at: w.deleted_at,
    saved_date: localDate(userTz(state, w.user_id), new Date(w.created_at)),
  };
}

export function publicContext(c: MockContext): Context {
  return {
    id: c.id,
    sentence: c.sentence,
    word_offset: c.word_offset,
    word_length: c.word_length,
    page_title: c.page_title,
    page_url: c.page_url,
    meaning: c.meaning,
    meaning_source: c.meaning_source,
    created_at: c.created_at,
  };
}
