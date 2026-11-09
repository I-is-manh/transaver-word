import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { decksApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/toastContext';
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton } from '@/components/ui';
import { qk } from '@/lib/queryKeys';
import { deckSwatches } from './deckColors';
import styles from './Decks.module.css';
import { ArrowIcon } from '@/components/ArrowIcon';

export function ColorPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (c: string | null) => void;
}) {
  const swatches = useMemo(deckSwatches, []);
  return (
    <div className={styles.swatches} role="radiogroup" aria-label="Màu deck">
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        aria-label="Không màu"
        className={`${styles.swatch} ${styles.none} ${value === null ? styles.swatchOn : ''}`}
        onClick={() => onChange(null)}
      />
      {swatches.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value?.toUpperCase() === c}
          aria-label={`Màu ${c}`}
          className={`${styles.swatch} ${value?.toUpperCase() === c ? styles.swatchOn : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}

export function DecksPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const decks = useQuery({
    queryKey: qk.decks,
    queryFn: () => decksApi.list().then((r) => r.data),
  });
  const [name, setName] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const create = useMutation({
    mutationFn: () => decksApi.create({ name: name.trim(), color }),
    onSuccess: ({ deck }) => {
      void qc.invalidateQueries({ queryKey: qk.decks });
      setName('');
      setColor(null);
      toast.show({ tone: 'success', message: `Đã tạo deck "${deck.name}".` });
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? (e.field('name') ?? e.field('color') ?? e.message)
          : 'Có lỗi xảy ra.',
      ),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (!name.trim()) return setError('Vui lòng nhập tên deck.');
    create.mutate();
  };

  return (
    <>
      <PageHeader
        back={
          <Link to="/words">
            <ArrowIcon dir="left" />
            Từ của tôi
          </Link>
        }
        title="Deck"
        subtitle="Nhóm từ theo chủ đề để ôn riêng. Xếp từ vào deck ở trang Từ của tôi; extension không hỏi deck khi lưu."
      />
      <div className={styles.layout}>
        <div>
          {decks.isPending ? (
            <Skeleton lines={5} />
          ) : decks.isError ? (
            <ErrorState error={decks.error} onRetry={() => void decks.refetch()} />
          ) : decks.data.length === 0 ? (
            <EmptyState title="Chưa có deck nào">
              Tạo deck đầu tiên ở bên phải, ví dụ “IELTS” hay “Công việc”.
            </EmptyState>
          ) : (
            <ul className={styles.list}>
              {decks.data.map((d) => (
                <li key={d.id}>
                  <Link to={`/decks/${d.id}`} className={styles.item}>
                    <span
                      className={styles.dot}
                      style={d.color ? { background: d.color } : undefined}
                      aria-hidden="true"
                    />
                    <span className={styles.itemName}>{d.name}</span>
                    <span className={styles.itemMeta}>
                      {d.words_count} từ
                      {d.due_count > 0 && <strong> · {d.due_count} cần ôn</strong>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Panel title="Tạo deck mới">
          <form className={styles.form} onSubmit={submit}>
            <TextField
              label="Tên deck"
              value={name}
              maxLength={100}
              onChange={(e) => {
                setName(e.target.value);
                setError(undefined);
              }}
              error={error}
            />
            <div>
              <span className={styles.label}>Màu</span>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <Button type="submit" loading={create.isPending}>
              Tạo deck
            </Button>
          </form>
        </Panel>
      </div>
    </>
  );
}
