import { useState } from 'react';
import { ApiError } from '@/api/client';

/**
 * Gom lỗi của form: lỗi theo trường (422) hiện cạnh ô, lỗi khác hiện ở đầu form.
 * Lỗi 422 của trường không có trên form cũng đưa lên đầu form để không bị mất.
 */
export function useFormErrors<F extends string>(fields: readonly F[]) {
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<F, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function reset() {
    setFieldErrors({});
    setFormError(null);
  }

  function fromError(err: unknown) {
    if (err instanceof ApiError && err.status === 422) {
      const next: Partial<Record<F, string>> = {};
      const orphan: string[] = [];
      for (const [key, messages] of Object.entries(err.errors)) {
        const msg = messages[0];
        if (!msg) continue;
        if ((fields as readonly string[]).includes(key)) next[key as F] = msg;
        else orphan.push(msg);
      }
      setFieldErrors(next);
      const hasField = Object.keys(next).length > 0;
      setFormError(orphan.length ? orphan.join(' ') : hasField ? null : err.message);
      return;
    }
    setFieldErrors({});
    setFormError(err instanceof Error ? err.message : 'Có lỗi xảy ra. Thử lại sau.');
  }

  function clearField(name: F) {
    setFieldErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  return { fieldErrors, formError, setFieldErrors, reset, fromError, clearField };
}
