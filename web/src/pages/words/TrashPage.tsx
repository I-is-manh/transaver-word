import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { wordsApi } from '@/api/words';
import { IconButton } from '@/components/IconButton';
import { useToast } from '@/components/toastContext';
import {
  ConfirmButton,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
} from '@/components/ui';
import { useDebounced } from '@/lib/useDebounced';
import { formatDate } from '@/lib/format';
import { qk } from '@/lib/queryKeys';
import styles from './Words.module.css';
import { ArrowIcon } from '@/components/ArrowIcon';

export function TrashPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const query = useDebounced(q.trim());
  const trash = useQuery({
    queryKey: [...qk.trash, query, page],
    queryFn: () => wordsApi.trash({ q: query || undefined, page }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.words });
    void qc.invalidateQueries({ queryKey: qk.stats });
  };
  const restore = useMutation({
    mutationFn: (id: number) => wordsApi.restore(id),
    onSuccess: ({ word }) => {
      refresh();
      toast.show({ tone: 'success', message: `Đã khôi phục "${word.text}".` });
    },
    onError: (e) => toast.show({ tone: 'error', message: (e as Error).message }),
  });
  const force = useMutation({
    mutationFn: (id: number) => wordsApi.forceDelete(id),
    onSuccess: () => {
      refresh();
      toast.show({ message: 'Đã xóa hẳn.' });
    },
    onError: (e) => toast.show({ tone: 'error', message: (e as Error).message }),
  });
  const rows = trash.data?.data ?? [];

  return (
    <>
      <PageHeader
        back={
          <Link to="/words">
            <ArrowIcon dir="left" />
            Từ của tôi
          </Link>
        }
        title="Thùng rác"
        subtitle="Từ trong thùng rác tự xóa hẳn sau 30 ngày. Khôi phục thì từ quay lại kèm lịch ôn cũ."
      />
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <span className="sr-only">Tìm trong thùng rác</span>
          <input
            type="search"
            placeholder="Tìm trong thùng rác…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      {trash.isPending ? (
        <Skeleton lines={4} />
      ) : trash.isError ? (
        <ErrorState error={trash.error} onRetry={() => void trash.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={query ? 'Không có từ nào khớp' : 'Thùng rác trống'} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Từ</th>
                <th>Nghĩa</th>
                <th>Ngày xóa</th>
                <th className={styles.actionsCol}>
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id}>
                  <td>
                    <Link to={`/words/${w.id}`} className={styles.wordLink}>
                      {w.text}
                    </Link>
                  </td>
                  <td className={w.meaning ? undefined : styles.muted}>{w.meaning ?? '—'}</td>
                  <td className={styles.nowrap}>{formatDate(w.deleted_at)}</td>
                  <td className={styles.actionsCol}>
                    <div className={styles.rowActions}>
                      <IconButton
                        icon="rotate-ccw"
                        label="Khôi phục"
                        aria-label={`Khôi phục "${w.text}"`}
                        onClick={() => restore.mutate(w.id)}
                      />
                      <ConfirmButton
                        confirmLabel="Xóa hẳn"
                        onConfirm={() => force.mutate(w.id)}
                        trigger={(ask) => (
                          <IconButton
                            icon="trash"
                            tone="danger"
                            label="Xóa hẳn"
                            aria-label={`Xóa hẳn "${w.text}"`}
                            tipAlign="end"
                            onClick={ask}
                          />
                        )}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {trash.data && (
        <Pagination
          page={trash.data.meta.current_page}
          lastPage={trash.data.meta.last_page}
          total={trash.data.meta.total}
          onPage={setPage}
        />
      )}
    </>
  );
}
