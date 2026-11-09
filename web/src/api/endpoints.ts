import { apiRequest } from './client';
import type {
  Achievement,
  AdminStats,
  AdminUser,
  AnswerRequest,
  AnswerResponse,
  Deck,
  FinishSessionResponse,
  HeatmapDay,
  ImpersonateResponse,
  ImpersonationLog,
  OnboardingRequest,
  Paginated,
  ProgressPoint,
  Role,
  Settings,
  StartSessionRequest,
  StartSessionResponse,
  StatsSummary,
  Today,
  User,
  WeeklyReport,
} from './types';

/** Mục 5 */
export const reviewApi = {
  start: (body: StartSessionRequest) =>
    apiRequest<StartSessionResponse>('/review/sessions', { method: 'POST', body }),
  answer: (body: AnswerRequest) =>
    apiRequest<AnswerResponse>('/review/answer', { method: 'POST', body }),
  finish: (sessionId: number) =>
    apiRequest<FinishSessionResponse>(`/review/sessions/${sessionId}/finish`, { method: 'POST' }),
};

/** Mục 6 */
export const settingsApi = {
  get: () => apiRequest<{ settings: Settings }>('/settings'),
  update: (body: Partial<Settings>) =>
    apiRequest<{ settings: Settings }>('/settings', { method: 'PATCH', body }),
  onboarding: (body: OnboardingRequest) =>
    apiRequest<{ user: User; settings: Settings }>('/onboarding', { method: 'POST', body }),
  today: () => apiRequest<Today>('/today'),
  /** Có mật khẩu: gửi password. Tài khoản Google không mật khẩu: gửi confirm_email (mục 6.2) */
  deleteAccount: (body: { password: string } | { confirm_email: string }) =>
    apiRequest<void>('/account', { method: 'DELETE', body }),
};

/** Mục 6.2, 8 */
export const statsApi = {
  summary: () => apiRequest<StatsSummary>('/stats/summary'),
  heatmap: (from?: string, to?: string) =>
    apiRequest<{ days: HeatmapDay[] }>('/stats/heatmap', { query: { from, to } }),
  progress: (days = 30) =>
    apiRequest<{ points: ProgressPoint[] }>('/stats/progress', { query: { days } }),
  achievements: () => apiRequest<{ data: Achievement[] }>('/achievements'),
  weekly: (weekStart?: string) =>
    apiRequest<WeeklyReport>('/reports/weekly', { query: { week_start: weekStart } }),
};

/** Mục 7 */
export const decksApi = {
  list: () => apiRequest<{ data: Deck[] }>('/decks'),
  create: (body: { name: string; color: string | null }) =>
    apiRequest<{ deck: Deck }>('/decks', { method: 'POST', body }),
  update: (id: number, body: { name?: string; color?: string | null }) =>
    apiRequest<{ deck: Deck }>(`/decks/${id}`, { method: 'PATCH', body }),
  remove: (id: number) => apiRequest<void>(`/decks/${id}`, { method: 'DELETE' }),
  addWords: (id: number, wordIds: number[]) =>
    apiRequest<{ deck: Deck }>(`/decks/${id}/words`, {
      method: 'POST',
      body: { word_ids: wordIds },
    }),
  removeWords: (id: number, wordIds: number[]) =>
    apiRequest<{ deck: Deck }>(`/decks/${id}/words`, {
      method: 'DELETE',
      body: { word_ids: wordIds },
    }),
};

/** Mục 9 */
export const adminApi = {
  stats: () => apiRequest<AdminStats>('/admin/stats'),
  users: (q: string, page: number) =>
    apiRequest<Paginated<AdminUser>>('/admin/users', { query: { q, page } }),
  updateUser: (id: number, body: { status?: AdminUser['status']; role?: Role }) =>
    apiRequest<{ user: AdminUser }>(`/admin/users/${id}`, { method: 'PATCH', body }),
  impersonate: (id: number) =>
    apiRequest<ImpersonateResponse>(`/admin/users/${id}/impersonate`, { method: 'POST' }),
  impersonations: (page: number) =>
    apiRequest<Paginated<ImpersonationLog>>('/admin/impersonations', { query: { page } }),
};

/** Mục 9.1 */
export const impersonationApi = {
  stop: () => apiRequest<void>('/impersonation/stop', { method: 'POST' }),
};
