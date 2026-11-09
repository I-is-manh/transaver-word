import { useCallback, useRef } from 'react';
import { ApiError } from '@/api/client';
import { reviewApi } from '@/api/endpoints';
import type { AnswerRequest, AnswerResponse } from '@/api/types';

/**
 * Gửi đáp án ở nền, không bắt người dùng chờ mạng giữa các thẻ.
 * Mỗi đáp án có client_uuid cố định → gửi lại khi lỗi mạng không bị tính hai lần (mục 5.4).
 */
export function useAnswerQueue(onResult: (res: AnswerResponse) => void, onGiveUp: () => void) {
  const pending = useRef(new Set<Promise<void>>());
  const failed = useRef<AnswerRequest[]>([]);

  const send = useCallback(
    (body: AnswerRequest) => {
      const run = async () => {
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            onResult(await reviewApi.answer(body));
            return;
          } catch (err) {
            // Lỗi dữ liệu (4xx trừ 429) thì thử lại cũng vô ích
            if (
              err instanceof ApiError &&
              err.status >= 400 &&
              err.status < 500 &&
              err.status !== 429
            )
              return;
            await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
          }
        }
        failed.current.push(body);
        onGiveUp();
      };
      const p = run().finally(() => pending.current.delete(p));
      pending.current.add(p);
    },
    [onResult, onGiveUp],
  );

  /** Đợi mọi đáp án gửi xong, gửi lại những cái đã thất bại một lần nữa. */
  const flush = useCallback(async () => {
    await Promise.allSettled([...pending.current]);
    const retry = failed.current.splice(0);
    for (const body of retry) send(body);
    await Promise.allSettled([...pending.current]);
    return failed.current.length === 0;
  }, [send]);

  return { send, flush };
}
