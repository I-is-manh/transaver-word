import { apiRequest } from './client';
import type {
  Context,
  DictionaryEntry,
  MeaningCandidate,
  Paginated,
  SaveWordRequest,
  SaveWordResponse,
  UpdateContextRequest,
  UpdateWordRequest,
  Word,
  WordDetailResponse,
  WordGroup,
  WordGroupBy,
  WordGroupParams,
  WordLanguage,
  WordListParams,
} from './types';

/** Mục 3 và 4 của contract. Giai đoạn 1 chưa dùng trên giao diện, để sẵn cho giai đoạn 2. */
export const wordsApi = {
  save: (body: SaveWordRequest) => apiRequest<SaveWordResponse>('/words', { method: 'POST', body }),
  list: (params: WordListParams = {}) =>
    apiRequest<Paginated<Word>>('/words', { query: { ...params } }),
  languages: () => apiRequest<{ data: WordLanguage[] }>('/words/languages'),
  groups: (params: WordGroupParams) =>
    apiRequest<{ by: WordGroupBy; data: WordGroup[] }>('/words/groups', { query: { ...params } }),
  get: (id: number) => apiRequest<WordDetailResponse>(`/words/${id}`),
  update: (id: number, body: UpdateWordRequest) =>
    apiRequest<{ word: Word }>(`/words/${id}`, { method: 'PATCH', body }),
  remove: (id: number) => apiRequest<void>(`/words/${id}`, { method: 'DELETE' }),
  trash: (params: { q?: string; page?: number; per_page?: number } = {}) =>
    apiRequest<Paginated<Word>>('/words/trash', { query: params }),
  restore: (id: number) => apiRequest<{ word: Word }>(`/words/${id}/restore`, { method: 'POST' }),
  forceDelete: (id: number) => apiRequest<void>(`/words/${id}/force`, { method: 'DELETE' }),
  updateContext: (id: number, contextId: number, body: UpdateContextRequest) =>
    apiRequest<{ word: Word; context: Context }>(`/words/${id}/contexts/${contextId}`, {
      method: 'PATCH',
      body,
    }),
  removeContext: (id: number, contextId: number) =>
    apiRequest<void>(`/words/${id}/contexts/${contextId}`, { method: 'DELETE' }),
  meaningCandidates: (id: number) =>
    apiRequest<{ meaning_candidates: MeaningCandidate[] }>(`/words/${id}/meaning-candidates`),
};

export const dictionaryApi = {
  lookup: (text: string, lang = 'en') =>
    apiRequest<{ entry: DictionaryEntry | null }>('/dictionary/lookup', { query: { text, lang } }),
};

export const healthApi = {
  check: () => apiRequest<{ ok: boolean }>('/health'),
};
