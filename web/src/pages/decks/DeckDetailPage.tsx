import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { decksApi } from '@/api/endpoints';
import { wordsApi } from '@/api/words';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { TextField } from '@/components/TextField';
import { UiIcon } from '@/components/UiIcon';
import { useToast } from '@/components/toastContext';
import {
  ConfirmButton,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
} from '@/components/ui';
import { formatDue } from '@/lib/format';
import { qk } from '@/lib/queryKeys';
import { ColorPicker } from './DecksPage';
import wordStyles from '../words/Words.module.css';
import styles from './Decks.module.css';
import { ArrowIcon } from '@/components/ArrowIcon';

export function DeckDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  const decks = useQuery({
    queryKey: qk.decks,
    queryFn: () => decksApi.list().then((r) => r.data),
  });
  const deck = decks.data?.find((d) => d.id === id);
  const words = useQuery({
    queryKey: [...qk.words, 'list', { deck_id: id, page }],
    queryFn: () => wordsApi.list({ deck_id: id, page, sort: 'text' }),
    placeholderData: keepPreviousData,
    enabled: !!deck,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.decks });
    void qc.invalidateQueries({ queryKey: qk.words });
  };
  const update = useMutation({
    mutationFn: () => decksApi.update(id, { name: name.trim(), color }),
    onSuccess: () => {
      refresh();
      setEditing(false);
    },
    onError: (e) =>
      setError(e instanceof ApiError ? (e.field('name') ?? e.message) : 'Có lỗi xảy ra.'),
  });
  const remove = useMutation({
    mutationFn: () => decksApi.remove(id),
    onSuccess: () => {
      // Rời trang trước, bỏ cache danh sách từ của deck đã xóa để không gọi lại (sẽ 404)
      navigate('/decks');
      qc.removeQueries({ queryKey: [...qk.words, 'list', { deck_id: id }], exact: false });
      refresh();
      toast.show({ message: `Đã xóa deck "${deck?.name}". Các từ vẫn được giữ.` });
    },
    onError: (e) => toast.show({ tone: 'error', message: (e as Error).message }),
  });
  const removeWord = useMutation({
    mutationFn: (wordId: number) => decksApi.removeWords(id, [wordId]),
    onSuccess: refresh,
    onError: (e) => toast.show({ tone: 'error', message: (e as Error).message }),
  });

  if (decks.isPending) return <Skeleton lines={6} />;
  if (decks.isError) return <ErrorState error={decks.error} onRetry={() => void decks.refetch()} />;
  if (!deck)
    return (
      <PageHeader
        title="Không tìm thấy deck"
        back={
          <Link to="/decks">
            <ArrowIcon dir="left" />
            Deck
          </Link>
        }
      />
    );

  return (
    <>
      <PageHeader
        back={
          <Link to="/decks">
            <ArrowIcon dir="left" />
            Deck
          </Link>
        }
        title={
          <span className={styles.titleRow}>
            <span
              className={styles.dotLg}
              style={deck.color ? { background: deck.color } : undefined}
              aria-hidden="true"
            />
            {deck.name}
          </span>
        }
        subtitle={`${deck.words_count} từ · ${deck.due_count} từ cần ôn hôm nay`}
        actions={
          <>
            <Button
              disabled={deck.words_count === 0}
              onClick={() => navigate(`/review?mode=deck&deck_id=${deck.id}`)}
            >
              Ôn deck này
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setName(deck.name);
                setColor(deck.color);
                setEditing((v) => !v);
              }}
            >
              <UiIcon name="pencil" />
              Sửa
            </Button>
            <ConfirmButton confirmLabel="Xóa deck" onConfirm={() => remove.mutate()}>
              <UiIcon name="trash" />
              Xóa deck
            </ConfirmButton>
          </>
        }
      />

      {editing && (
        <form
          className={`${styles.form} ${styles.editForm}`}
          onSubmit={(e) => {
            e.preventDefault();
            setError(undefined);
            update.mutate();
          }}
        >
          <TextField
            label="Tên deck"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            error={error}
            autoFocus
          />
          <ColorPicker value={color} onChange={setColor} />
          <div className={styles.row}>
            <Button type="submit" loading={update.isPending}>
              Lưu
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Hủy
            </Button>
          </div>
        </form>
      )}

      {words.isPending ? (
        <Skeleton lines={5} />
      ) : words.isError ? (
        <ErrorState error={words.error} onRetry={() => void words.refetch()} />
      ) : words.data.data.length === 0 ? (
        <EmptyState
          title="Deck chưa có từ nào"
          action={<Link to="/words">Chọn từ để thêm vào deck</Link>}
        >
          Ở trang Từ của tôi, tích chọn các từ rồi chọn “Thêm vào deck…”.
        </EmptyState>
      ) : (
        <>
          <div className={wordStyles.tableWrap}>
            <table className={wordStyles.table}>
              <thead>
                <tr>
                  <th>Từ</th>
                  <th>Nghĩa</th>
                  <th>Lịch ôn</th>
                  <th className={wordStyles.actionsCol}>
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {words.data.data.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <Link to={`/words/${w.id}`} className={wordStyles.wordLink}>
                        {w.text}
                      </Link>
                    </td>
                    <td className={w.meaning ? undefined : wordStyles.muted}>
                      {w.meaning ?? 'Chưa chọn nghĩa'}
                    </td>
                    <td className={wordStyles.nowrap}>
                      {w.status === 'known' ? 'Đã biết' : formatDue(w.due_at)}
                    </td>
                    <td className={wordStyles.actionsCol}>
                      <div className={wordStyles.rowActions}>
                        <IconButton
                          icon="x"
                          tone="danger"
                          label="Bỏ khỏi deck"
                          aria-label={`Bỏ "${w.text}" khỏi deck`}
                          tipAlign="end"
                          disabled={removeWord.isPending}
                          onClick={() => removeWord.mutate(w.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={words.data.meta.current_page}
            lastPage={words.data.meta.last_page}
            total={words.data.meta.total}
            onPage={setPage}
          />
        </>
      )}
    </>
  );
}
