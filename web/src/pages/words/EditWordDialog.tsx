import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import type { UpdateWordRequest, Word, WordKind } from '@/api/types';
import { wordsApi } from '@/api/words';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/Segmented';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/toastContext';
import { qk } from '@/lib/queryKeys';
import styles from './EditWordDialog.module.css';

const KINDS = [
  { value: 'word', label: 'Từ' },
  { value: 'phrase', label: 'Cụm từ' },
] as const;

const kindOf = (text: string): WordKind => (/\s/.test(text.trim()) ? 'phrase' : 'word');

/** Hộp thoại "Sửa từ" dùng chung cho /words và /words/:id (contract mục 3.7). */
export function EditWordDialog({ word, onClose }: { word: Word; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const ref = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const noteId = useId();

  const [text, setText] = useState(word.text);
  const [meaning, setMeaning] = useState(word.meaning ?? '');
  const [note, setNote] = useState(word.note ?? '');
  // Chưa chạm vào "Loại" thì loại đi theo chữ (server cũng tự tính lại khi đổi chữ).
  const [kindTouched, setKindTouched] = useState(false);
  const [kindPicked, setKindPicked] = useState<WordKind>(word.kind);
  const textChanged = text.trim() !== word.text;
  const kind: WordKind = kindTouched ? kindPicked : textChanged ? kindOf(text) : word.kind;

  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const first = d?.querySelector('input');
    first?.focus();
    first?.select();
  }, []);

  const save = useMutation({
    mutationFn: (body: UpdateWordRequest) => wordsApi.update(word.id, body),
    onSuccess: () => {
      // qk.words là tiền tố của danh sách lẫn chi tiết (qk.word(id)).
      void qc.invalidateQueries({ queryKey: qk.words });
      toast.show({ tone: 'success', message: 'Đã lưu' });
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422) {
        const next = {
          text: e.field('text'),
          meaning: e.field('meaning'),
          kind: e.field('kind'),
          note: e.field('note'),
        };
        setErrors(Object.values(next).some(Boolean) ? next : { form: e.message });
      } else setErrors({ form: e instanceof Error ? e.message : 'Có lỗi xảy ra.' });
    },
  });

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (save.isPending) return;
    const t = text.trim();
    if (!t) {
      setErrors({ text: 'Hãy nhập từ hoặc cụm từ.' });
      return;
    }
    const body: UpdateWordRequest = {};
    if (t !== word.text) body.text = t;
    const m = meaning.trim() || null;
    if (m !== word.meaning) body.meaning = m;
    const n = note.trim() || null;
    if (n !== (word.note ?? null)) body.note = n;
    // Đổi chữ mà không chọn loại → để server tự tính lại; đã chọn thì gửi để giữ lựa chọn.
    if (kindTouched && (kindPicked !== word.kind || body.text !== undefined))
      body.kind = kindPicked;
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    setErrors({});
    save.mutate(body);
  };

  // Enter trong ghi chú cũng lưu; Shift+Enter để xuống dòng.
  const onNoteKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // bấm ra nền mờ thì đóng
        if (e.target === ref.current) onClose();
      }}
    >
      <form ref={formRef} onSubmit={submit} className={styles.form} noValidate>
        <h2 id={titleId} className={styles.title}>
          Sửa từ
        </h2>

        <TextField
          label="Từ / cụm từ"
          value={text}
          maxLength={100}
          onChange={(e) => {
            setText(e.target.value);
            setErrors((x) => ({ ...x, text: undefined }));
          }}
          error={errors.text}
          hint={
            textChanged ? 'Lịch ôn giữ nguyên; vị trí từ trong câu sẽ được tính lại.' : undefined
          }
          autoComplete="off"
          spellCheck={false}
        />

        <TextField
          label="Nghĩa"
          value={meaning}
          maxLength={500}
          placeholder="Nghĩa chính bạn muốn nhớ"
          onChange={(e) => {
            setMeaning(e.target.value);
            setErrors((x) => ({ ...x, meaning: undefined }));
          }}
          error={errors.meaning}
          autoComplete="off"
        />

        <div className={styles.field}>
          <Segmented
            label="Loại"
            options={KINDS}
            value={kind}
            onChange={(v) => {
              setKindTouched(true);
              setKindPicked(v);
              setErrors((x) => ({ ...x, kind: undefined }));
            }}
          />
          {errors.kind && <p className={styles.error}>{errors.kind}</p>}
        </div>

        <div className={styles.field}>
          <label htmlFor={noteId} className={styles.label}>
            Ghi chú
          </label>
          <textarea
            id={noteId}
            className={styles.textarea}
            value={note}
            maxLength={1000}
            rows={3}
            placeholder="Ví dụ: gặp trong bài báo BBC"
            onChange={(e) => {
              setNote(e.target.value);
              setErrors((x) => ({ ...x, note: undefined }));
            }}
            onKeyDown={onNoteKey}
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={`${noteId}-msg`}
          />
          <p id={`${noteId}-msg`} className={errors.note ? styles.error : styles.hint}>
            {errors.note ?? `Shift + Enter để xuống dòng · ${note.length}/1000`}
          </p>
        </div>

        {errors.form && (
          <p className={styles.error} role="alert">
            {errors.form}
          </p>
        )}

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={save.isPending}>
            Lưu
          </Button>
        </div>
      </form>
    </dialog>
  );
}
