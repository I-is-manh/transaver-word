import {
  delay,
  http,
  HttpResponse,
  type DefaultBodyType,
  type PathParams,
  type StrictRequest,
} from 'msw';
import { API_BASE_URL } from '@/api/client';
import type {
  AnswerRequest,
  Card,
  ExerciseType,
  LoginRequest,
  MeaningCandidate,
  OnboardingRequest,
  Paginated,
  Rating,
  RegisterRequest,
  SaveWordRequest,
  Settings,
  StartSessionRequest,
  UpdateContextRequest,
  UpdateWordRequest,
} from '@/api/types';
import {
  ACHIEVEMENTS,
  DEFAULT_SETTINGS,
  DICTIONARY,
  HARD_LAPSES,
  achievementView,
  activityOf,
  addDays,
  addXp,
  applyRating,
  checkAchievements,
  dailyProgress,
  db,
  diffDays,
  emptyStreak,
  endOfToday,
  intervalsFor,
  isDue,
  localDate,
  makeContext,
  makeWord,
  normalize,
  nowIso,
  persist,
  publicContext,
  publicUser,
  publicWord,
  streakView,
  toIso,
  touchStreak,
  userTz,
  xpOf,
  type MockContext,
  type MockImpersonation,
  type MockState,
  type MockWord,
} from './db';

const api = (path: string) => `${API_BASE_URL}${path}`;

type Req = StrictRequest<DefaultBodyType>;
type Errors = Record<string, string[]>;

// ---------------------------------------------------------------- tiện ích

const latency = () => delay(200);

function validation(errors: Errors) {
  const all = Object.values(errors).flat();
  const first = all[0] ?? 'Dữ liệu không hợp lệ.';
  const message = all.length > 1 ? `${first} (và ${all.length - 1} lỗi khác)` : first;
  return HttpResponse.json({ message, errors }, { status: 422 });
}

const msg = (status: number, message: string) => HttpResponse.json({ message }, { status });
const notFound = () => msg(404, 'Không tìm thấy.');
const noContent = () => new HttpResponse(null, { status: 204 });

function bearer(request: Req): string | null {
  const m = /^Bearer\s+(.+)$/.exec(request.headers.get('Authorization') ?? '');
  return m ? m[1]! : null;
}

function issueToken(state: MockState, userId: number): string {
  const id = ++state.seq.token;
  const rand = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const token = `${id}|${rand}`;
  state.tokens[token] = userId;
  return token;
}

async function readJson<T>(request: Req): Promise<Partial<T>> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === 'object' ? (body as Partial<T>) : {};
  } catch {
    return {};
  }
}

function paginate<T>(items: T[], url: URL): Paginated<T> {
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get('per_page')) || 20));
  const total = items.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(lastPage, Math.max(1, Number(url.searchParams.get('page')) || 1));
  const link = (p: number) => {
    const u = new URL(url);
    u.searchParams.set('page', String(p));
    return u.toString();
  };
  return {
    data: items.slice((page - 1) * perPage, page * perPage),
    links: {
      first: link(1),
      last: link(lastPage),
      prev: page > 1 ? link(page - 1) : null,
      next: page < lastPage ? link(page + 1) : null,
    },
    meta: { current_page: page, last_page: lastPage, per_page: perPage, total },
  };
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function findOwnWord(userId: number, id: unknown, withTrashed = false): MockWord | null {
  const w = db().words.find((x) => x.id === Number(id) && x.user_id === userId);
  if (!w || (!withTrashed && w.deleted_at)) return null;
  return w;
}

/** Bộ lọc chung của GET /words và GET /words/groups (mục 3.5, 3.11). */
function filterWords(state: MockState, userId: number, url: URL): MockWord[] {
  const q = (url.searchParams.get('q') ?? '').toLowerCase();
  const status = url.searchParams.get('status');
  const kind = url.searchParams.get('kind');
  const deckId = Number(url.searchParams.get('deck_id')) || null;
  const hard = url.searchParams.get('hard') === '1';
  const lang = url.searchParams.get('lang');
  const inDeck = deckId
    ? new Set(state.deckWords.filter((d) => d.deck_id === deckId).map((d) => d.word_id))
    : null;
  return state.words
    .filter((w) => w.user_id === userId && !w.deleted_at)
    .filter((w) => !q || contains(w.text, q) || contains(w.meaning, q))
    .filter((w) => !status || w.status === status)
    .filter((w) => !kind || w.kind === kind)
    .filter((w) => !lang || w.source_lang === lang)
    .filter((w) => !inDeck || inDeck.has(w.id))
    .filter((w) => !hard || (w.status === 'learning' && w.lapses >= HARD_LAPSES));
}

function candidatesFor(
  word: MockWord,
  translation?: string | null,
  key: 'translation' | 'current' = 'translation',
): MeaningCandidate[] {
  const list: MeaningCandidate[] = [];
  if (translation) {
    list.push({
      key,
      source: 'translation',
      part_of_speech: null,
      text: translation,
      example: null,
    });
  }
  const dict = word.source_lang === 'en' ? DICTIONARY[word.normalized_text] : undefined;
  dict?.meanings.forEach((m, i) =>
    list.push({
      key: `dict-${i}`,
      source: 'dictionary',
      part_of_speech: m.part_of_speech,
      text: m.definition,
      example: m.example,
    }),
  );
  return list.slice(0, 8);
}

const contains = (hay: string | null, q: string) => (hay ?? '').toLowerCase().includes(q);

interface Ctx {
  request: Req;
  params: PathParams;
  userId: number;
  state: MockState;
  token: string;
  /** Khác null khi đang dùng token impersonate (mục 9.1) */
  impersonation: MockImpersonation | null;
}

const IMPERSONATION_MINUTES = 120;
const BLOCKED_WHILE_IMPERSONATING =
  'Không thực hiện được khi đang đăng nhập với tư cách người khác.';

function impersonatorView(state: MockState, imp: MockImpersonation | null) {
  if (!imp) return null;
  const u = state.users.find((x) => x.id === imp.impersonator_id);
  return u ? { id: u.id, email: u.email } : null;
}

function endImpersonation(state: MockState, token: string) {
  const imp = state.impersonations[token];
  if (!imp) return;
  const log = state.impersonationLogs.find((l) => l.id === imp.log_id);
  if (log && !log.ended_at) log.ended_at = nowIso();
  delete state.impersonations[token];
  delete state.tokens[token];
}

/** Bọc handler cần đăng nhập (401 thiếu token, 403 tài khoản bị khóa). */
function authed(fn: (c: Ctx) => Promise<Response> | Response) {
  return async ({ request, params }: { request: Req; params: PathParams }) => {
    await latency();
    const state = db();
    const token = bearer(request);
    const userId = token ? state.tokens[token] : undefined;
    if (!token || userId === undefined) return msg(401, 'Chưa đăng nhập.');
    const imp = state.impersonations[token] ?? null;
    if (imp && new Date(imp.expires_at) <= new Date()) {
      endImpersonation(state, token);
      persist();
      return msg(401, 'Phiên đăng nhập với tư cách người khác đã hết hạn.');
    }
    const user = state.users.find((u) => u.id === userId);
    if (!user) return msg(401, 'Chưa đăng nhập.');
    if (user.status === 'banned') return msg(403, 'Tài khoản này đã bị khóa.');
    return fn({ request, params, userId, state, token, impersonation: imp });
  };
}

function adminOnly(fn: (c: Ctx) => Promise<Response> | Response) {
  return authed((c) => {
    if (c.impersonation) return msg(403, BLOCKED_WHILE_IMPERSONATING);
    const me = c.state.users.find((u) => u.id === c.userId);
    if (me?.role !== 'admin' && me?.role !== 'superadmin')
      return msg(403, 'Bạn không có quyền truy cập trang quản trị.');
    return fn(c);
  });
}

function superadminOnly(fn: (c: Ctx) => Promise<Response> | Response) {
  return adminOnly((c) => {
    const me = c.state.users.find((u) => u.id === c.userId);
    if (me?.role !== 'superadmin') return msg(403, 'Chỉ superadmin mới làm được việc này.');
    return fn(c);
  });
}

const loginFailures = new Map<string, number[]>();

// ---------------------------------------------------------------- ôn tập

const EXERCISE_ORDER: ExerciseType[] = ['flashcard', 'mcq', 'listening', 'cloze', 'dictation'];

function chooseExercise(
  state: MockState,
  w: MockWord,
  ctx: MockContext | null,
  settings: Settings,
) {
  const on = new Set<ExerciseType>(['flashcard', ...settings.exercise_types]);
  const distractors = state.words.filter(
    (x) => x.user_id === w.user_id && x.id !== w.id && !x.deleted_at && x.meaning,
  );
  if (w.fsrs_state === 0 || !w.meaning) return 'flashcard';
  let wanted: ExerciseType[];
  if (w.stability < 7) wanted = Math.random() < 0.5 ? ['mcq', 'listening'] : ['listening', 'mcq'];
  else
    wanted = ctx
      ? Math.random() < 0.6
        ? ['cloze', 'dictation']
        : ['dictation', 'cloze']
      : ['dictation'];
  for (const t of wanted) {
    if (!on.has(t)) continue;
    if ((t === 'mcq' || t === 'listening') && distractors.length < 3) continue;
    return t;
  }
  // Lùi về dạng dễ hơn đang bật
  const idx = Math.min(...wanted.map((t) => EXERCISE_ORDER.indexOf(t)));
  for (let i = idx - 1; i >= 0; i--) {
    const t = EXERCISE_ORDER[i]!;
    if (!on.has(t)) continue;
    if ((t === 'mcq' || t === 'listening') && distractors.length < 3) continue;
    if (t === 'cloze' && !ctx) continue;
    return t;
  }
  return 'flashcard';
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function buildCard(state: MockState, w: MockWord, settings: Settings): Card {
  const contexts = state.contexts
    .filter((c) => c.word_id === w.id)
    .sort((a, b) => (a.last_used_at ?? '').localeCompare(b.last_used_at ?? ''));
  const usable = contexts.find((c) => c.word_offset !== null && c.word_length !== null) ?? null;
  const type = chooseExercise(state, w, usable, settings);
  const ctx = type === 'cloze' ? usable : type === 'flashcard' ? (contexts[0] ?? null) : null;
  let cloze: Card['cloze'] = null;
  let answerText: string | null = null;
  let options: Card['options'] = null;
  let answerKey: string | null = null;
  if (type === 'cloze' && ctx) {
    const start = ctx.word_offset!;
    const end = start + ctx.word_length!;
    answerText = ctx.sentence.slice(start, end);
    cloze = {
      before: ctx.sentence.slice(0, start),
      after: ctx.sentence.slice(end),
      hint: w.stability < 7 ? answerText.slice(0, 1) : null,
    };
  }
  if (type === 'dictation') answerText = w.text;
  if (type === 'mcq' || type === 'listening') {
    const others = shuffle(
      state.words.filter(
        (x) =>
          x.user_id === w.user_id &&
          x.id !== w.id &&
          !x.deleted_at &&
          x.meaning &&
          x.meaning !== w.meaning,
      ),
    ).slice(0, 3);
    const texts = shuffle([w.meaning!, ...others.map((o) => o.meaning!)]);
    const keys = ['a', 'b', 'c', 'd'];
    options = texts.map((text, i) => ({ key: keys[i]!, text }));
    answerKey = options.find((o) => o.text === w.meaning)!.key;
  }
  return {
    card_id: `${w.id}-${type}`,
    word: publicWord(state, w),
    exercise_type: type,
    context: ctx ? publicContext(ctx) : null,
    cloze,
    options,
    answer_key: answerKey,
    answer_text: answerText,
    intervals: intervalsFor(w, settings.desired_retention),
  };
}

// ---------------------------------------------------------------- handler

export const handlers = [
  // 1.7
  http.get(api('/health'), () => HttpResponse.json({ ok: true })),

  // 2.2
  http.post(api('/auth/register'), async ({ request }) => {
    await latency();
    const body = await readJson<RegisterRequest>(request);
    const errors: Errors = {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const state = db();
    if (!email) errors.email = ['Vui lòng nhập email.'];
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = ['Email không hợp lệ.'];
    else if (email.length > 255) errors.email = ['Email tối đa 255 ký tự.'];
    else if (state.users.some((u) => u.email === email)) errors.email = ['Email đã được sử dụng.'];
    const password = typeof body.password === 'string' ? body.password : '';
    if (!password) errors.password = ['Vui lòng nhập mật khẩu.'];
    else if (password.length < 8) errors.password = ['Mật khẩu phải có ít nhất 8 ký tự.'];
    else if (password.length > 72) errors.password = ['Mật khẩu tối đa 72 ký tự.'];
    else if (password !== body.password_confirmation)
      errors.password = ['Mật khẩu nhập lại không khớp.'];
    if (body.timezone && !isValidTimezone(body.timezone))
      errors.timezone = ['Múi giờ không hợp lệ.'];
    if (Object.keys(errors).length) return validation(errors);

    const tz = body.timezone || 'Asia/Ho_Chi_Minh';
    const user = {
      id: ++state.seq.user,
      email,
      password,
      name: null,
      role: 'user' as const,
      timezone: tz,
      onboarding_completed: false,
      created_at: nowIso(),
      status: 'active' as const,
    };
    state.users.push(user);
    state.settings[user.id] = DEFAULT_SETTINGS(tz);
    state.userSetFields[user.id] = [];
    state.streaks[user.id] = emptyStreak();
    state.xp[user.id] = 0;
    const token = issueToken(state, user.id);
    persist();
    return HttpResponse.json({ token, user: publicUser(user) }, { status: 201 });
  }),

  // 2.3
  http.post(api('/auth/login'), async ({ request }) => {
    await latency();
    const body = await readJson<LoginRequest>(request);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const errors: Errors = {};
    if (!email) errors.email = ['Vui lòng nhập email.'];
    if (!body.password) errors.password = ['Vui lòng nhập mật khẩu.'];
    if (Object.keys(errors).length) return validation(errors);
    const now = Date.now();
    const recent = (loginFailures.get(email) ?? []).filter((t) => now - t < 60000);
    if (recent.length >= 5) {
      const retry = Math.ceil((60000 - (now - recent[0]!)) / 1000);
      return HttpResponse.json(
        { message: `Đăng nhập sai quá nhiều lần. Thử lại sau ${retry} giây.` },
        { status: 429, headers: { 'Retry-After': String(retry) } },
      );
    }
    const state = db();
    const user = state.users.find((u) => u.email === email);
    if (!user || user.password !== body.password) {
      loginFailures.set(email, [...recent, now]);
      return validation({ email: ['Email hoặc mật khẩu không đúng.'] });
    }
    if (user.status === 'banned') return msg(403, 'Tài khoản này đã bị khóa.');
    loginFailures.delete(email);
    const token = issueToken(state, user.id);
    persist();
    return HttpResponse.json({ token, user: publicUser(user) });
  }),

  // 2.7 Gửi lại email xác nhận: tài khoản mock luôn đã xác nhận
  http.post(
    api('/email/verification-notification'),
    authed(async () => {
      await latency();
      return HttpResponse.json({ message: 'Email của bạn đã được xác nhận.', sent: false });
    }),
  ),

  // 2.6 Đăng nhập Google: chế độ mock đăng nhập luôn vào tài khoản demo
  http.post(api('/auth/google/exchange'), async ({ request }) => {
    await latency();
    const body = await readJson<{ code?: string }>(request);
    if (typeof body.code !== 'string' || body.code.length !== 64) {
      return validation({
        code: ['Mã đăng nhập Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.'],
      });
    }
    const state = db();
    const user = state.users.find((u) => u.email === 'demo@transaver.vn');
    if (!user) return msg(500, 'Không có tài khoản demo trong dữ liệu giả.');
    if (user.status === 'banned') return msg(403, 'Tài khoản này đã bị khóa.');
    const token = issueToken(state, user.id);
    persist();
    return HttpResponse.json({ token, user: publicUser(user), created: false });
  }),

  // 2.4
  http.post(
    api('/auth/logout'),
    authed(({ token, state, impersonation }) => {
      if (impersonation) return msg(403, BLOCKED_WHILE_IMPERSONATING);
      delete state.tokens[token];
      persist();
      return noContent();
    }),
  ),

  // 2.5
  http.get(
    api('/me'),
    authed(({ userId, state, impersonation }) =>
      HttpResponse.json({
        user: publicUser(
          state.users.find((u) => u.id === userId)!,
          impersonatorView(state, impersonation),
        ),
      }),
    ),
  ),

  // 3.4
  http.post(
    api('/words'),
    authed(async ({ request, userId, state }) => {
      const body = await readJson<SaveWordRequest>(request);
      const errors: Errors = {};
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text) errors.text = ['Vui lòng nhập từ.'];
      else if (text.length > 100) errors.text = ['Từ tối đa 100 ký tự.'];
      const sentence = typeof body.sentence === 'string' ? body.sentence.trim() : '';
      if (!sentence) errors.sentence = ['Thiếu câu ngữ cảnh.'];
      else if (sentence.length > 500) errors.sentence = ['Câu tối đa 500 ký tự.'];
      for (const f of ['source_lang', 'target_lang'] as const) {
        const v = body[f];
        if (typeof v !== 'string' || v.length < 2 || v.length > 10)
          errors[f] = ['Mã ngôn ngữ không hợp lệ.'];
      }
      if (body.page_url && (!/^https?:\/\//i.test(body.page_url) || body.page_url.length > 2048))
        errors.page_url = ['Link trang không hợp lệ.'];
      if (Object.keys(errors).length) return validation(errors);

      const source = body.source_lang!;
      const target = body.target_lang!;
      const normalized = normalize(text);
      let word = state.words.find(
        (w) =>
          w.user_id === userId &&
          w.source_lang === source &&
          w.target_lang === target &&
          w.normalized_text === normalized,
      );
      let wordCreated = false;
      if (word?.deleted_at) word.deleted_at = null;
      if (!word) {
        word = makeWord(state, userId, text, source, target);
        wordCreated = true;
        activityOf(state, userId, localDate(userTz(state, userId))).words_saved += 1;
      }
      const keepPage = state.settings[userId]?.save_page_url !== false;
      let context = state.contexts.find((c) => c.word_id === word.id && c.sentence === sentence);
      let contextCreated = false;
      if (!context) {
        // v0.4: câu mới luôn nhận nghĩa từ translation; save_page_url=false → bỏ cả url lẫn title
        context = makeContext(state, word, {
          sentence,
          word_offset: body.word_offset ?? null,
          word_length: body.word_length ?? null,
          page_title: keepPage ? (body.page_title ?? null) : null,
          page_url: keepPage ? (body.page_url ?? null) : null,
          meaning: body.translation || null,
          meaning_source: body.translation ? 'translation' : null,
        });
        contextCreated = true;
      }
      if (body.translation && !word.meaning) word.meaning = body.translation;
      word.updated_at = nowIso();
      const fresh = checkAchievements(state, userId);
      persist();
      return HttpResponse.json(
        {
          word: publicWord(state, word),
          context: publicContext(context),
          word_created: wordCreated,
          context_created: contextCreated,
          meaning_candidates: candidatesFor(word, body.translation),
          new_achievements: fresh,
        },
        { status: wordCreated ? 201 : 200 },
      );
    }),
  ),

  // 3.8 (đặt trước /words/:id)
  http.get(
    api('/words/trash'),
    authed(({ request, userId, state }) => {
      const url = new URL(request.url);
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      const items = state.words
        .filter((w) => w.user_id === userId && w.deleted_at)
        .filter((w) => !q || contains(w.text, q) || contains(w.meaning, q))
        .sort((a, b) => (b.deleted_at ?? '').localeCompare(a.deleted_at ?? ''))
        .map((w) => publicWord(state, w));
      return HttpResponse.json(paginate(items, url));
    }),
  ),

  // 8.4
  http.get(
    api('/words/highlight-list'),
    authed(({ userId, state }) =>
      HttpResponse.json({
        generated_at: nowIso(),
        words: state.words
          .filter(
            (w) =>
              w.user_id === userId &&
              !w.deleted_at &&
              w.status === 'learning' &&
              w.source_lang === 'en',
          )
          .map((w) => ({
            id: w.id,
            text: w.text,
            normalized_text: w.normalized_text,
            kind: w.kind,
            meaning: w.meaning,
          })),
      }),
    ),
  ),

  // 3.5 (+ lang, saved_from, saved_to của 3.11)
  http.get(
    api('/words'),
    authed(({ request, userId, state }) => {
      const url = new URL(request.url);
      const sort = url.searchParams.get('sort') ?? '-created_at';
      const from = url.searchParams.get('saved_from');
      const to = url.searchParams.get('saved_to');
      const tz = userTz(state, userId);
      const items = filterWords(state, userId, url).filter((w) => {
        if (!from && !to) return true;
        const d = localDate(tz, new Date(w.created_at));
        return (!from || d >= from) && (!to || d <= to);
      });
      const cmp: Record<string, (a: MockWord, b: MockWord) => number> = {
        '-created_at': (a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id,
        created_at: (a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id,
        text: (a, b) => a.text.localeCompare(b.text),
        due_at: (a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'),
      };
      items.sort(cmp[sort] ?? cmp['-created_at']);
      return HttpResponse.json(
        paginate(
          items.map((w) => publicWord(state, w)),
          url,
        ),
      );
    }),
  ),

  // 3.11
  http.get(
    api('/words/languages'),
    authed(({ userId, state }) => {
      const counts = new Map<string, number>();
      for (const w of state.words)
        if (w.user_id === userId && !w.deleted_at)
          counts.set(w.source_lang, (counts.get(w.source_lang) ?? 0) + 1);
      const data = [...counts]
        .map(([lang, count]) => ({ lang, count }))
        .sort((a, b) => b.count - a.count || a.lang.localeCompare(b.lang));
      return HttpResponse.json({ data });
    }),
  ),

  http.get(
    api('/words/groups'),
    authed(({ request, userId, state }) => {
      const url = new URL(request.url);
      const by = url.searchParams.get('by');
      if (by !== 'day' && by !== 'month' && by !== 'year')
        return validation({ by: ['Cách nhóm không hợp lệ.'] });
      const order = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc';
      const tz = userTz(state, userId);
      const counts = new Map<string, number>();
      for (const w of filterWords(state, userId, url)) {
        const d = localDate(tz, new Date(w.created_at));
        const key = by === 'day' ? d : by === 'month' ? d.slice(0, 7) : d.slice(0, 4);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const range = (key: string) => {
        if (by === 'day') return { from: key, to: key };
        if (by === 'year') return { from: `${key}-01-01`, to: `${key}-12-31` };
        const [y, m] = key.split('-').map(Number) as [number, number];
        const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
        return { from: `${key}-01`, to: `${key}-${String(last).padStart(2, '0')}` };
      };
      const data = [...counts]
        .sort(([a], [b]) => (order === 'desc' ? b.localeCompare(a) : a.localeCompare(b)))
        .slice(0, 1000)
        .map(([key, count]) => ({ key, ...range(key), count }));
      return HttpResponse.json({ by, data });
    }),
  ),

  // 3.6
  http.get(
    api('/words/:id'),
    authed(({ params, userId, state }) => {
      const word = findOwnWord(userId, params.id, true);
      if (!word) return notFound();
      const contexts = state.contexts
        .filter((c) => c.word_id === word.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
        .map(publicContext);
      return HttpResponse.json({ word: publicWord(state, word), contexts });
    }),
  ),

  // 3.7
  http.patch(
    api('/words/:id'),
    authed(async ({ request, params, userId, state }) => {
      const word = findOwnWord(userId, params.id);
      if (!word) return notFound();
      const body = await readJson<UpdateWordRequest>(request);
      const errors: Errors = {};
      let newText: string | undefined;
      if (body.text !== undefined) {
        newText = String(body.text ?? '').trim();
        if (!newText) errors.text = ['Hãy nhập từ hoặc cụm từ.'];
        else if (newText.length > 100) errors.text = ['Từ hoặc cụm từ tối đa 100 ký tự.'];
        else {
          const dup = state.words.find(
            (w) =>
              w.id !== word.id &&
              w.user_id === userId &&
              w.source_lang === word.source_lang &&
              w.target_lang === word.target_lang &&
              w.normalized_text === normalize(newText!),
          );
          if (dup)
            errors.text = [
              dup.deleted_at
                ? 'Từ này đang nằm trong thùng rác. Hãy khôi phục từ đó.'
                : 'Bạn đã lưu từ này rồi.',
            ];
        }
      }
      if (body.meaning !== undefined && body.meaning !== null && String(body.meaning).length > 500)
        errors.meaning = ['Nghĩa tối đa 500 ký tự.'];
      if (body.note !== undefined && body.note !== null && String(body.note).length > 1000)
        errors.note = ['Ghi chú tối đa 1000 ký tự.'];
      if (body.status !== undefined && !['learning', 'known'].includes(body.status))
        errors.status = ['Trạng thái không hợp lệ.'];
      if (body.kind !== undefined && !['word', 'phrase'].includes(body.kind))
        errors.kind = ['Loại từ không hợp lệ.'];
      if (Object.keys(errors).length) return validation(errors);
      if (newText !== undefined && newText !== word.text) {
        const normalized = normalize(newText);
        const changed = normalized !== word.normalized_text;
        word.text = newText;
        if (changed) {
          // Giữ nguyên lịch ôn; tra lại từ điển và tính lại vị trí trong mọi câu.
          word.normalized_text = normalized;
          word.kind = normalized.includes(' ') ? 'phrase' : 'word';
          const dict = word.source_lang === 'en' ? DICTIONARY[normalized] : undefined;
          word.phonetic = dict?.phonetic ?? null;
          word.audio_url = dict?.audio_url ?? null;
          word.part_of_speech = dict?.meanings[0]?.part_of_speech ?? null;
          for (const c of state.contexts.filter((x) => x.word_id === word.id)) {
            const off = c.sentence.toLowerCase().indexOf(normalized);
            c.word_offset = off >= 0 ? off : null;
            c.word_length = off >= 0 ? normalized.length : null;
          }
        }
      }
      if (body.meaning !== undefined) word.meaning = body.meaning?.trim() || null;
      if (body.note !== undefined) word.note = body.note?.trim() || null;
      if (body.status) word.status = body.status;
      if (body.kind) word.kind = body.kind;
      word.updated_at = nowIso();
      persist();
      return HttpResponse.json({ word: publicWord(state, word) });
    }),
  ),

  http.delete(
    api('/words/:id'),
    authed(({ params, userId }) => {
      const word = findOwnWord(userId, params.id, true);
      if (!word) return notFound();
      word.deleted_at ??= nowIso();
      persist();
      return noContent();
    }),
  ),

  http.post(
    api('/words/:id/restore'),
    authed(({ params, userId, state }) => {
      const word = findOwnWord(userId, params.id, true);
      if (!word) return notFound();
      word.deleted_at = null;
      word.updated_at = nowIso();
      persist();
      return HttpResponse.json({ word: publicWord(state, word) });
    }),
  ),

  http.delete(
    api('/words/:id/force'),
    authed(({ params, userId, state }) => {
      const word = findOwnWord(userId, params.id, true);
      if (!word) return notFound();
      if (!word.deleted_at) return msg(409, 'Chỉ xóa hẳn được từ đang trong thùng rác.');
      state.words = state.words.filter((w) => w.id !== word.id);
      state.contexts = state.contexts.filter((c) => c.word_id !== word.id);
      state.deckWords = state.deckWords.filter((d) => d.word_id !== word.id);
      persist();
      return noContent();
    }),
  ),

  // 3.9
  http.patch(
    api('/words/:id/contexts/:contextId'),
    authed(async ({ request, params, userId, state }) => {
      const word = findOwnWord(userId, params.id);
      if (!word) return notFound();
      const context = state.contexts.find(
        (c) => c.id === Number(params.contextId) && c.word_id === word.id,
      );
      if (!context) return notFound();
      const body = await readJson<UpdateContextRequest>(request);
      const errors: Errors = {};
      if (body.meaning !== null && body.meaning !== undefined && String(body.meaning).length > 500)
        errors.meaning = ['Nghĩa tối đa 500 ký tự.'];
      if (
        !body.meaning_source ||
        !['dictionary', 'user', 'translation'].includes(body.meaning_source)
      )
        errors.meaning_source = ['Nguồn nghĩa không hợp lệ.'];
      if (Object.keys(errors).length) return validation(errors);
      context.meaning = body.meaning?.trim() || null;
      context.meaning_source = body.meaning_source!;
      if (word.meaning === null && context.meaning) word.meaning = context.meaning;
      word.updated_at = nowIso();
      persist();
      return HttpResponse.json({ word: publicWord(state, word), context: publicContext(context) });
    }),
  ),

  http.delete(
    api('/words/:id/contexts/:contextId'),
    authed(({ params, userId, state }) => {
      const word = findOwnWord(userId, params.id);
      if (!word) return notFound();
      const context = state.contexts.find(
        (c) => c.id === Number(params.contextId) && c.word_id === word.id,
      );
      if (!context) return notFound();
      if (word.contexts_count <= 1)
        return validation({ context: ['Không thể xóa câu ngữ cảnh cuối cùng của từ.'] });
      state.contexts = state.contexts.filter((c) => c.id !== context.id);
      word.contexts_count -= 1;
      persist();
      return noContent();
    }),
  ),

  // 3.10
  http.get(
    api('/words/:id/meaning-candidates'),
    authed(({ params, userId }) => {
      const word = findOwnWord(userId, params.id, true);
      if (!word) return notFound();
      return HttpResponse.json({
        meaning_candidates: candidatesFor(word, word.meaning, 'current'),
      });
    }),
  ),

  // 4.1
  http.get(
    api('/dictionary/lookup'),
    authed(({ request }) => {
      const url = new URL(request.url);
      const text = normalize(url.searchParams.get('text') ?? '');
      const lang = url.searchParams.get('lang') ?? 'en';
      const dict = lang === 'en' ? DICTIONARY[text] : undefined;
      return HttpResponse.json({ entry: dict ? { text, ...dict } : null });
    }),
  ),

  // 5.3
  http.post(
    api('/review/sessions'),
    authed(async ({ request, userId, state }) => {
      const body = await readJson<StartSessionRequest>(request);
      const mode = body.mode ?? 'daily';
      if (!['daily', 'hard', 'deck'].includes(mode))
        return validation({ mode: ['Chế độ ôn không hợp lệ.'] });
      const settings = state.settings[userId] ?? DEFAULT_SETTINGS(userTz(state, userId));
      let pool = state.words.filter((w) => w.user_id === userId && !w.deleted_at);
      if (mode === 'deck') {
        const deck = state.decks.find((d) => d.id === Number(body.deck_id) && d.user_id === userId);
        if (!deck) return notFound();
        const ids = new Set(
          state.deckWords.filter((d) => d.deck_id === deck.id).map((d) => d.word_id),
        );
        pool = pool.filter((w) => ids.has(w.id));
      }
      let picked: MockWord[];
      let overload = false;
      if (mode === 'hard') {
        picked = pool
          .filter((w) => w.status === 'learning' && w.lapses >= HARD_LAPSES)
          .sort((a, b) => b.lapses - a.lapses)
          .slice(0, 20);
      } else {
        const end = endOfToday(userTz(state, userId));
        const dueAll = pool
          .filter((w) => isDue(w, end))
          .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''));
        overload = dueAll.length > settings.daily_review_limit;
        const due = dueAll.slice(0, settings.daily_review_limit);
        const learned = activityOf(
          state,
          userId,
          localDate(userTz(state, userId)),
        ).new_words_learned;
        const newCount = overload ? 0 : Math.max(0, settings.daily_new_words - learned);
        const fresh = pool
          .filter((w) => w.status === 'learning' && w.fsrs_state === 0)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .slice(0, newCount);
        // Xen kẽ từ mới vào giữa từ ôn
        picked = [];
        const step = fresh.length ? Math.max(1, Math.floor(due.length / fresh.length)) : 0;
        let f = 0;
        due.forEach((w, i) => {
          picked.push(w);
          if (step && (i + 1) % step === 0 && f < fresh.length) picked.push(fresh[f++]!);
        });
        while (f < fresh.length) picked.push(fresh[f++]!);
      }
      const session = {
        id: ++state.seq.session,
        user_id: userId,
        mode,
        deck_id: mode === 'deck' ? Number(body.deck_id) : null,
        started_at: nowIso(),
        ended_at: null,
        cards_reviewed: 0,
        correct_count: 0,
        new_cards: 0,
        xp_earned: 0,
        newly_mastered: 0,
        had_again: false,
      };
      state.sessions.push(session);
      const cards = picked.map((w) => buildCard(state, w, settings));
      persist();
      return HttpResponse.json(
        {
          session: {
            id: session.id,
            mode: session.mode,
            deck_id: session.deck_id,
            started_at: session.started_at,
          },
          cards,
          overload,
        },
        { status: 201 },
      );
    }),
  ),

  // 5.4
  http.post(
    api('/review/answer'),
    authed(async ({ request, userId, state }) => {
      const body = await readJson<AnswerRequest>(request);
      if (body.client_uuid) {
        const prev = state.logs.find((l) => l.client_uuid === body.client_uuid);
        if (prev && prev.user_id !== userId) return msg(409, 'client_uuid đã được dùng.');
        if (prev) return HttpResponse.json(prev.response as Record<string, unknown>);
      }
      const errors: Errors = {};
      if (!body.client_uuid) errors.client_uuid = ['Thiếu client_uuid.'];
      if (![1, 2, 3, 4].includes(Number(body.rating)))
        errors.rating = ['Mức đánh giá không hợp lệ.'];
      if (!body.exercise_type) errors.exercise_type = ['Thiếu dạng bài.'];
      if (Object.keys(errors).length) return validation(errors);
      const session = state.sessions.find(
        (s) => s.id === Number(body.session_id) && s.user_id === userId,
      );
      if (!session) return notFound();
      const word = findOwnWord(userId, body.user_word_id);
      if (!word) return notFound();
      if (
        body.word_context_id &&
        !state.contexts.some((c) => c.id === body.word_context_id && c.word_id === word.id)
      )
        return validation({ word_context_id: ['Câu ngữ cảnh không thuộc từ này.'] });
      const rating = Number(body.rating) as Rating;
      const settings = state.settings[userId] ?? DEFAULT_SETTINGS(userTz(state, userId));
      const today = localDate(userTz(state, userId));
      const { comeback } = touchStreak(state, userId);
      const { wasNew, becameMastered } = applyRating(word, rating, settings.desired_retention);
      if (body.word_context_id) {
        const c = state.contexts.find((x) => x.id === body.word_context_id);
        if (c) c.last_used_at = nowIso();
      }
      const a = activityOf(state, userId, today);
      a.reviews_count += 1;
      if (rating >= 2) a.correct_count += 1;
      if (wasNew) a.new_words_learned += 1;
      let xp = rating >= 3 ? 10 : rating === 2 ? 5 : 0;
      if (becameMastered) xp += 50;
      addXp(state, userId, xp);
      session.cards_reviewed += 1;
      if (rating >= 2) session.correct_count += 1;
      if (rating === 1) session.had_again = true;
      if (wasNew) session.new_cards += 1;
      if (becameMastered) session.newly_mastered += 1;
      session.xp_earned += xp;
      const fresh = checkAchievements(state, userId, { comeback });
      const response = {
        word: publicWord(state, word),
        next_due_at: word.due_at,
        xp_earned: xp,
        became_mastered: becameMastered,
        today: dailyProgress(state, userId),
        streak: streakView(state, userId),
        new_achievements: fresh,
      };
      state.logs.push({
        client_uuid: body.client_uuid!,
        user_id: userId,
        word_id: word.id,
        rating,
        exercise_type: body.exercise_type!,
        date: today,
        created_at: nowIso(),
        response,
      });
      persist();
      return HttpResponse.json(response);
    }),
  ),

  // 5.5
  http.post(
    api('/review/sessions/:id/finish'),
    authed(({ params, userId, state }) => {
      const session = state.sessions.find(
        (s) => s.id === Number(params.id) && s.user_id === userId,
      );
      if (!session) return notFound();
      let fresh: ReturnType<typeof checkAchievements> = [];
      if (!session.ended_at) {
        session.ended_at = nowIso();
        if (session.cards_reviewed > 0) {
          fresh = checkAchievements(state, userId, {
            sessionFinished: true,
            perfectSession: session.cards_reviewed >= 10 && !session.had_again,
          });
        }
      }
      const duration = Math.max(
        0,
        Math.round(
          (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000,
        ),
      );
      persist();
      return HttpResponse.json({
        summary: {
          cards_reviewed: session.cards_reviewed,
          correct_count: session.correct_count,
          new_cards: session.new_cards,
          xp_earned: session.xp_earned,
          duration_seconds: duration,
          newly_mastered: session.newly_mastered,
        },
        today: dailyProgress(state, userId),
        streak: streakView(state, userId),
        xp: xpOf(state.xp[userId] ?? 0),
        new_achievements: fresh,
      });
    }),
  ),

  // 6.2
  http.get(
    api('/settings'),
    authed(({ userId, state }) =>
      HttpResponse.json({
        settings: {
          ...state.settings[userId]!,
          // Dữ liệu mock cũ (trước v0.11) chưa có trường này
          appearance: state.settings[userId]!.appearance ?? 'system',
          timezone: userTz(state, userId),
        },
      }),
    ),
  ),

  http.patch(
    api('/settings'),
    authed(async ({ request, userId, state }) => {
      const body = await readJson<Settings>(request);
      const errors: Errors = {};
      const cur = state.settings[userId]!;
      const next: Settings = { ...cur };
      const int = (v: unknown) => typeof v === 'number' && Number.isInteger(v);
      if (body.timezone !== undefined) {
        if (!isValidTimezone(body.timezone)) errors.timezone = ['Múi giờ không hợp lệ.'];
        else next.timezone = body.timezone;
      }
      if (body.daily_new_words !== undefined) {
        if (!int(body.daily_new_words) || body.daily_new_words < 1 || body.daily_new_words > 50)
          errors.daily_new_words = ['Số từ mới mỗi ngày phải từ 1 đến 50.'];
        else next.daily_new_words = body.daily_new_words;
      }
      if (body.reminder_time !== undefined) {
        if (body.reminder_time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.reminder_time))
          errors.reminder_time = ['Giờ nhắc phải có dạng HH:MM.'];
        else next.reminder_time = body.reminder_time;
      }
      if (body.reminder_channels !== undefined) {
        if (
          !Array.isArray(body.reminder_channels) ||
          body.reminder_channels.some((c) => !['browser', 'email'].includes(c))
        )
          errors.reminder_channels = ['Kênh nhắc không hợp lệ.'];
        else next.reminder_channels = [...new Set(body.reminder_channels)];
      }
      if (body.exercise_types !== undefined) {
        const valid: ExerciseType[] = ['flashcard', 'mcq', 'cloze', 'listening', 'dictation'];
        if (
          !Array.isArray(body.exercise_types) ||
          body.exercise_types.some((t) => !valid.includes(t))
        )
          errors.exercise_types = ['Dạng bài không hợp lệ.'];
        else
          next.exercise_types = valid.filter(
            (t) => t === 'flashcard' || body.exercise_types!.includes(t),
          );
      }
      if (body.save_page_url !== undefined) next.save_page_url = !!body.save_page_url;
      if (body.weekly_report !== undefined) next.weekly_report = !!body.weekly_report;
      if (body.appearance !== undefined) {
        if (!['system', 'light', 'dark'].includes(body.appearance))
          errors.appearance = ['Giao diện không hợp lệ.'];
        else next.appearance = body.appearance;
      }
      if (body.daily_review_limit !== undefined) {
        if (
          !int(body.daily_review_limit) ||
          body.daily_review_limit < 20 ||
          body.daily_review_limit > 500
        )
          errors.daily_review_limit = ['Giới hạn ôn mỗi ngày phải từ 20 đến 500.'];
        else next.daily_review_limit = body.daily_review_limit;
      }
      if (body.desired_retention !== undefined) {
        const r = Number(body.desired_retention);
        if (!(r >= 0.8 && r <= 0.97))
          errors.desired_retention = ['Mức ghi nhớ phải từ 80% đến 97%.'];
        else next.desired_retention = Math.round(r * 100) / 100;
      }
      if (body.card_display !== undefined)
        next.card_display = { ...cur.card_display, ...body.card_display };
      if (Object.keys(errors).length) return validation(errors);
      state.settings[userId] = next;
      const user = state.users.find((u) => u.id === userId)!;
      user.timezone = next.timezone;
      state.userSetFields[userId] = [
        ...new Set([...(state.userSetFields[userId] ?? []), ...Object.keys(body)]),
      ];
      persist();
      return HttpResponse.json({ settings: next });
    }),
  ),

  http.post(
    api('/onboarding'),
    authed(async ({ request, userId, state }) => {
      const body = await readJson<OnboardingRequest>(request);
      const errors: Errors = {};
      if (!body.goal || !['exam', 'work', 'travel', 'hobby'].includes(body.goal))
        errors.goal = ['Hãy chọn mục tiêu.'];
      if (!body.level || !['beginner', 'intermediate', 'advanced'].includes(body.level))
        errors.level = ['Hãy chọn trình độ.'];
      if (![5, 10, 20].includes(Number(body.daily_minutes)))
        errors.daily_minutes = ['Hãy chọn thời gian mỗi ngày.'];
      if (Object.keys(errors).length) return validation(errors);
      const userSet = new Set(state.userSetFields[userId] ?? []);
      const s = state.settings[userId]!;
      const derived: Partial<Settings> = {
        daily_new_words: ({ 5: 3, 10: 7, 20: 15 } as Record<number, number>)[
          Number(body.daily_minutes)
        ]!,
        exercise_types:
          body.level === 'beginner' ? ['flashcard', 'mcq'] : ['flashcard', 'mcq', 'cloze'],
        desired_retention: body.goal === 'exam' ? 0.92 : 0.9,
      };
      for (const [k, v] of Object.entries(derived)) {
        if (!userSet.has(k)) (s as unknown as Record<string, unknown>)[k] = v;
      }
      const user = state.users.find((u) => u.id === userId)!;
      user.onboarding_completed = true;
      persist();
      return HttpResponse.json({ user: publicUser(user), settings: s });
    }),
  ),

  http.get(
    api('/stats/summary'),
    authed(({ userId, state }) => {
      const words = state.words.filter((w) => w.user_id === userId && !w.deleted_at);
      const tz = userTz(state, userId);
      const end = endOfToday(tz);
      const settings = state.settings[userId]!;
      const today = dailyProgress(state, userId);
      const newAvail = words.filter((w) => w.status === 'learning' && w.fsrs_state === 0).length;
      return HttpResponse.json({
        saved_count: words.length,
        learning_count: words.filter((w) => w.status === 'learning').length,
        known_count: words.filter((w) => w.status === 'known').length,
        mastered_count: words.filter((w) => w.is_mastered).length,
        hard_count: words.filter((w) => w.status === 'learning' && w.lapses >= HARD_LAPSES).length,
        due_today: Math.min(words.filter((w) => isDue(w, end)).length, settings.daily_review_limit),
        new_available_today: Math.min(
          newAvail,
          Math.max(0, settings.daily_new_words - today.new_words_learned),
        ),
        today,
        streak: streakView(state, userId),
        xp: xpOf(state.xp[userId] ?? 0),
      });
    }),
  ),

  http.get(
    api('/today'),
    authed(({ userId, state }) => {
      const s = state.settings[userId]!;
      const p = dailyProgress(state, userId);
      return HttpResponse.json({
        date: p.date,
        studied: streakView(state, userId).today_done,
        due_count: p.due_remaining,
        reminder_time: s.reminder_time,
        reminder_channels: s.reminder_channels,
      });
    }),
  ),

  http.delete(
    api('/account'),
    authed(async ({ request, userId, state, impersonation }) => {
      if (impersonation) return msg(403, BLOCKED_WHILE_IMPERSONATING);
      const body = await readJson<{ password: string }>(request);
      const user = state.users.find((u) => u.id === userId)!;
      if (!body.password) return validation({ password: ['Vui lòng nhập mật khẩu.'] });
      if (body.password !== user.password)
        return validation({ password: ['Mật khẩu không đúng.'] });
      const wordIds = new Set(state.words.filter((w) => w.user_id === userId).map((w) => w.id));
      state.users = state.users.filter((u) => u.id !== userId);
      state.words = state.words.filter((w) => w.user_id !== userId);
      state.contexts = state.contexts.filter((c) => !wordIds.has(c.word_id));
      state.deckWords = state.deckWords.filter((d) => !wordIds.has(d.word_id));
      state.decks = state.decks.filter((d) => d.user_id !== userId);
      state.sessions = state.sessions.filter((s) => s.user_id !== userId);
      state.logs = state.logs.filter((l) => l.user_id !== userId);
      for (const [t, id] of Object.entries(state.tokens)) if (id === userId) delete state.tokens[t];
      delete state.settings[userId];
      delete state.activity[userId];
      delete state.streaks[userId];
      delete state.xp[userId];
      delete state.earned[userId];
      persist();
      return noContent();
    }),
  ),

  // 7
  http.get(
    api('/decks'),
    authed(({ userId, state }) =>
      HttpResponse.json({
        data: state.decks
          .filter((d) => d.user_id === userId)
          .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
          .map((d) => deckView(state, d.id)),
      }),
    ),
  ),

  http.post(
    api('/decks'),
    authed(async ({ request, userId, state }) => {
      const body = await readJson<{ name: string; color: string | null }>(request);
      const err = deckErrors(state, userId, body, null);
      if (err) return validation(err);
      const deck = {
        id: ++state.seq.deck,
        user_id: userId,
        name: cleanName(body.name!),
        color: body.color ? body.color.toUpperCase() : null,
        created_at: nowIso(),
      };
      state.decks.push(deck);
      persist();
      return HttpResponse.json({ deck: deckView(state, deck.id) }, { status: 201 });
    }),
  ),

  http.patch(
    api('/decks/:id'),
    authed(async ({ request, params, userId, state }) => {
      const deck = state.decks.find((d) => d.id === Number(params.id) && d.user_id === userId);
      if (!deck) return notFound();
      const body = await readJson<{ name: string; color: string | null }>(request);
      const err = deckErrors(state, userId, body, deck.id);
      if (err) return validation(err);
      if (body.name !== undefined) deck.name = cleanName(body.name);
      if (body.color !== undefined) deck.color = body.color ? body.color.toUpperCase() : null;
      persist();
      return HttpResponse.json({ deck: deckView(state, deck.id) });
    }),
  ),

  http.delete(
    api('/decks/:id'),
    authed(({ params, userId, state }) => {
      const deck = state.decks.find((d) => d.id === Number(params.id) && d.user_id === userId);
      if (!deck) return notFound();
      state.decks = state.decks.filter((d) => d.id !== deck.id);
      state.deckWords = state.deckWords.filter((d) => d.deck_id !== deck.id);
      persist();
      return noContent();
    }),
  ),

  http.post(
    api('/decks/:id/words'),
    authed(async ({ request, params, userId, state }) => {
      const deck = state.decks.find((d) => d.id === Number(params.id) && d.user_id === userId);
      if (!deck) return notFound();
      const body = await readJson<{ word_ids: number[] }>(request);
      const ids = Array.isArray(body.word_ids) ? body.word_ids.map(Number) : [];
      if (!ids.length || ids.length > 200)
        return validation({ word_ids: ['Chọn từ 1 đến 200 từ.'] });
      const bad: Errors = {};
      ids.forEach((id, i) => {
        if (!findOwnWord(userId, id))
          bad[`word_ids.${i}`] = ['Từ không tồn tại hoặc đang trong thùng rác.'];
      });
      if (Object.keys(bad).length) return validation(bad);
      for (const id of ids) {
        if (!state.deckWords.some((d) => d.deck_id === deck.id && d.word_id === id))
          state.deckWords.push({ deck_id: deck.id, word_id: id });
      }
      persist();
      return HttpResponse.json({ deck: deckView(state, deck.id) });
    }),
  ),

  http.delete(
    api('/decks/:id/words'),
    authed(async ({ request, params, userId, state }) => {
      const deck = state.decks.find((d) => d.id === Number(params.id) && d.user_id === userId);
      if (!deck) return notFound();
      const body = await readJson<{ word_ids: number[] }>(request);
      const ids = new Set(Array.isArray(body.word_ids) ? body.word_ids.map(Number) : []);
      state.deckWords = state.deckWords.filter(
        (d) => !(d.deck_id === deck.id && ids.has(d.word_id)),
      );
      persist();
      return HttpResponse.json({ deck: deckView(state, deck.id) });
    }),
  ),

  // 8.1
  http.get(
    api('/achievements'),
    authed(({ userId, state }) => {
      const earned = state.earned[userId] ?? {};
      return HttpResponse.json({
        data: ACHIEVEMENTS.filter((a) => !a.hidden || earned[a.code]).map((a) =>
          achievementView(a, earned[a.code] ?? null),
        ),
      });
    }),
  ),

  // 8.2
  http.get(
    api('/reports/weekly'),
    authed(({ request, userId, state }) => {
      const url = new URL(request.url);
      const tz = userTz(state, userId);
      const today = localDate(tz);
      let start = url.searchParams.get('week_start');
      if (!start) {
        const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = thứ Hai
        start = addDays(today, -dow - 7);
      }
      const week = (s: string) => {
        let days = 0;
        let reviews = 0;
        let saved = 0;
        let correct = 0;
        let xp = 0;
        for (let i = 0; i < 7; i++) {
          const a = state.activity[userId]?.[addDays(s, i)];
          if (!a) continue;
          if (a.reviews_count > 0) days += 1;
          reviews += a.reviews_count;
          saved += a.words_saved;
          correct += a.correct_count;
          xp += a.xp_earned;
        }
        const end = addDays(s, 6);
        const mastered = state.words.filter(
          (w) =>
            w.user_id === userId &&
            w.mastered_at &&
            localDate(tz, new Date(w.mastered_at)) >= s &&
            localDate(tz, new Date(w.mastered_at)) <= end,
        ).length;
        return {
          days_active: days,
          reviews_count: reviews,
          words_saved: saved,
          newly_mastered: mastered,
          accuracy: reviews ? Math.round((correct / reviews) * 100) / 100 : 0,
          xp_earned: xp,
        };
      };
      const cur = week(start);
      const prev = week(addDays(start, -7));
      return HttpResponse.json({
        week_start: start,
        week_end: addDays(start, 6),
        ...cur,
        mastered_total: state.words.filter((w) => w.user_id === userId && w.is_mastered).length,
        previous: {
          days_active: prev.days_active,
          reviews_count: prev.reviews_count,
          words_saved: prev.words_saved,
          newly_mastered: prev.newly_mastered,
          accuracy: prev.accuracy,
        },
      });
    }),
  ),

  // 8.3
  http.get(
    api('/stats/heatmap'),
    authed(({ request, userId, state }) => {
      const url = new URL(request.url);
      const today = localDate(userTz(state, userId));
      const to = url.searchParams.get('to') ?? today;
      const from = url.searchParams.get('from') ?? addDays(to, -364);
      if (diffDays(to, from) > 365) return validation({ from: ['Khoảng ngày tối đa 366 ngày.'] });
      const days = Object.entries(state.activity[userId] ?? {})
        .filter(
          ([d, a]) => d >= from && d <= to && (a.reviews_count || a.words_saved || a.freeze_used),
        )
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, a]) => ({
          date,
          reviews_count: a.reviews_count,
          words_saved: a.words_saved,
          freeze_used: a.freeze_used,
        }));
      return HttpResponse.json({ days });
    }),
  ),

  http.get(
    api('/stats/progress'),
    authed(({ request, userId, state }) => {
      const url = new URL(request.url);
      const n = Number(url.searchParams.get('days') ?? 30);
      if (!(n >= 7 && n <= 365)) return validation({ days: ['Số ngày phải từ 7 đến 365.'] });
      const tz = userTz(state, userId);
      const today = localDate(tz);
      const words = state.words.filter((w) => w.user_id === userId && !w.deleted_at);
      const points = [];
      for (let i = n - 1; i >= 0; i--) {
        const date = addDays(today, -i);
        points.push({
          date,
          saved_total: words.filter((w) => localDate(tz, new Date(w.created_at)) <= date).length,
          mastered_total: words.filter(
            (w) => w.mastered_at && localDate(tz, new Date(w.mastered_at)) <= date,
          ).length,
          reviews_count: state.activity[userId]?.[date]?.reviews_count ?? 0,
        });
      }
      return HttpResponse.json({ points });
    }),
  ),

  // 9
  http.get(
    api('/admin/stats'),
    adminOnly(({ state }) => {
      const today = localDate('Asia/Ho_Chi_Minh');
      let reviewsToday = 0;
      let reviews7 = 0;
      const active = new Set<number>();
      for (const [uid, days] of Object.entries(state.activity)) {
        for (const [d, a] of Object.entries(days)) {
          if (d === today) reviewsToday += a.reviews_count;
          if (diffDays(today, d) < 7 && diffDays(today, d) >= 0) {
            reviews7 += a.reviews_count;
            if (a.reviews_count) active.add(Number(uid));
          }
        }
      }
      return HttpResponse.json({
        users_total: state.users.length,
        users_active_7d: active.size,
        words_total: state.words.filter((w) => !w.deleted_at).length,
        reviews_today: reviewsToday,
        reviews_7d: reviews7,
      });
    }),
  ),

  http.get(
    api('/admin/users'),
    adminOnly(({ request, state }) => {
      const url = new URL(request.url);
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      const items = state.users
        .filter((u) => !q || u.email.includes(q))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((u) => adminUserView(state, u.id));
      return HttpResponse.json(paginate(items, url));
    }),
  ),

  http.patch(
    api('/admin/users/:id'),
    adminOnly(async ({ request, params, userId, state }) => {
      const target = state.users.find((u) => u.id === Number(params.id));
      if (!target) return notFound();
      const body = await readJson<{
        status: 'active' | 'banned';
        role: 'user' | 'admin' | 'superadmin';
      }>(request);
      const me = state.users.find((u) => u.id === userId)!;
      // Mục 9.1: chỉ superadmin sửa tài khoản superadmin hoặc cấp vai trò superadmin
      if (me.role !== 'superadmin' && (target.role === 'superadmin' || body.role === 'superadmin'))
        return msg(403, 'Chỉ superadmin mới sửa được tài khoản superadmin.');
      const errors: Errors = {};
      if (body.status !== undefined && !['active', 'banned'].includes(body.status))
        errors.status = ['Trạng thái không hợp lệ.'];
      if (body.role !== undefined && !['user', 'admin', 'superadmin'].includes(body.role))
        errors.role = ['Vai trò không hợp lệ.'];
      if (target.id === userId && body.status === 'banned')
        errors.status = ['Bạn không thể tự khóa tài khoản của mình.'];
      if (target.id === userId && body.role !== undefined && body.role !== me.role)
        errors.role = ['Bạn không thể tự đổi quyền của mình.'];
      if (Object.keys(errors).length) return validation(errors);
      if (body.status) {
        target.status = body.status;
        if (body.status === 'banned')
          for (const [t, id] of Object.entries(state.tokens))
            if (id === target.id) {
              endImpersonation(state, t);
              delete state.tokens[t];
            }
      }
      if (body.role) target.role = body.role;
      persist();
      return HttpResponse.json({ user: adminUserView(state, target.id) });
    }),
  ),

  // 9.1
  http.post(
    api('/admin/users/:id/impersonate'),
    superadminOnly(({ params, userId, state }) => {
      const target = state.users.find((u) => u.id === Number(params.id));
      if (!target) return notFound();
      if (target.id === userId)
        return validation({ user: ['Không thể đăng nhập với tư cách chính mình.'] });
      if (target.role === 'superadmin')
        return validation({ user: ['Không thể đăng nhập với tư cách một superadmin khác.'] });
      if (target.status === 'banned')
        return validation({ user: ['Không thể đăng nhập với tư cách tài khoản đang bị khóa.'] });
      const token = issueToken(state, target.id);
      const log = {
        id: ++state.seq.impersonationLog,
        impersonator_id: userId,
        user_id: target.id,
        started_at: nowIso(),
        ended_at: null,
      };
      state.impersonationLogs.push(log);
      const imp = {
        user_id: target.id,
        impersonator_id: userId,
        expires_at: toIso(new Date(Date.now() + IMPERSONATION_MINUTES * 60000)),
        log_id: log.id,
      };
      state.impersonations[token] = imp;
      persist();
      return HttpResponse.json(
        {
          token,
          user: publicUser(target, impersonatorView(state, imp)),
          expires_at: imp.expires_at,
        },
        { status: 201 },
      );
    }),
  ),

  http.post(
    api('/impersonation/stop'),
    authed(({ token, state, impersonation }) => {
      if (!impersonation)
        return validation({ token: ['Bạn không đang đăng nhập với tư cách người khác.'] });
      endImpersonation(state, token);
      persist();
      return noContent();
    }),
  ),

  http.get(
    api('/admin/impersonations'),
    superadminOnly(({ request, state }) => {
      const email = (id: number) => state.users.find((u) => u.id === id)?.email ?? '(đã xóa)';
      const items = [...state.impersonationLogs]
        .sort((a, b) => b.id - a.id)
        .map((l) => ({
          id: l.id,
          impersonator_email: email(l.impersonator_id),
          user_email: email(l.user_id),
          started_at: l.started_at,
          ended_at: l.ended_at,
        }));
      return HttpResponse.json(paginate(items, new URL(request.url)));
    }),
  ),
];

const cleanName = (n: string) => n.trim().replace(/\s+/g, ' ');

function deckView(state: MockState, deckId: number) {
  const d = state.decks.find((x) => x.id === deckId)!;
  const ids = new Set(state.deckWords.filter((x) => x.deck_id === d.id).map((x) => x.word_id));
  const words = state.words.filter((w) => ids.has(w.id) && !w.deleted_at);
  const end = endOfToday(userTz(state, d.user_id));
  return {
    id: d.id,
    name: d.name,
    color: d.color,
    words_count: words.length,
    due_count: words.filter((w) => isDue(w, end)).length,
    created_at: d.created_at,
  };
}

function deckErrors(
  state: MockState,
  userId: number,
  body: Partial<{ name: string; color: string | null }>,
  selfId: number | null,
): Errors | null {
  const errors: Errors = {};
  if (selfId === null || body.name !== undefined) {
    const name = typeof body.name === 'string' ? cleanName(body.name) : '';
    if (!name) errors.name = ['Vui lòng nhập tên deck.'];
    else if (name.length > 100) errors.name = ['Tên deck tối đa 100 ký tự.'];
    else if (
      state.decks.some(
        (d) =>
          d.user_id === userId && d.id !== selfId && d.name.toLowerCase() === name.toLowerCase(),
      )
    )
      errors.name = ['Bạn đã có deck tên này.'];
  }
  if (body.color !== undefined && body.color !== null && !/^#[0-9a-fA-F]{6}$/.test(body.color))
    errors.color = ['Màu phải có dạng #RRGGBB.'];
  return Object.keys(errors).length ? errors : null;
}

function adminUserView(state: MockState, id: number) {
  const u = state.users.find((x) => x.id === id)!;
  const days = Object.entries(state.activity[id] ?? {})
    .filter(([, a]) => a.reviews_count > 0)
    .map(([d]) => d)
    .sort();
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    status: u.status,
    created_at: u.created_at,
    words_count: state.words.filter((w) => w.user_id === id && !w.deleted_at).length,
    last_active_date: days.at(-1) ?? null,
  };
}
