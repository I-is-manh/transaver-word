import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { Word, WordGroup, WordGroupBy, WordListParams } from '@/api/types';
import { wordsApi } from '@/api/words';
import { Button } from '@/components/Button';
import { useToast } from '@/components/toastContext';
import { Skeleton } from '@/components/ui';
import { UiIcon } from '@/components/UiIcon';
import { qk } from '@/lib/queryKeys';
import { groupKeyOf, groupTitle } from '@/lib/wordGroups';
import styles from './Words.module.css';

const PER_PAGE = 30;

export type WordFilters = Pick<
  WordListParams,
  'q' | 'status' | 'kind' | 'deck_id' | 'hard' | 'lang'
>;

/**
 * Danh sách từ gom theo ngày/tháng/năm (contract mục 3.11): tải dần theo trang (cuộn gần cuối hoặc
 * bấm "Tải thêm"), mỗi từ vào nhóm theo saved_date; số từ của nhóm lấy từ /words/groups.
 */
export function GroupedWordList({
  filters,
  by,
  order,
  groups,
  today,
  selected,
  onSelect,
  renderRow,
  header,
}: {
  filters: WordFilters;
  by: WordGroupBy;
  order: 'desc' | 'asc';
  groups: WordGroup[];
  today: string;
  selected: Set<number>;
  onSelect: (update: (prev: Set<number>) => Set<number>) => void;
  renderRow: (w: Word) => ReactNode;
  /** <thead> của bảng */
  header: ReactNode;
}) {
  const toast = useToast();
  const sort = order === 'asc' ? 'created_at' : '-created_at';
  const list = useInfiniteQuery({
    queryKey: [...qk.words, 'infinite', { ...filters, sort }],
    queryFn: ({ pageParam }) =>
      wordsApi.list({ ...filters, sort, page: pageParam, per_page: PER_PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined,
  });

  // Từ đã tải, chia theo khóa nhóm (bỏ trùng nếu trang bị dịch khi có từ mới/xóa)
  const byKey = useMemo(() => {
    const map = new Map<string, Word[]>();
    const seen = new Set<number>();
    for (const page of list.data?.pages ?? [])
      for (const w of page.data) {
        if (seen.has(w.id)) continue;
        seen.add(w.id);
        const k = groupKeyOf(w.saved_date, by);
        const arr = map.get(k);
        if (arr) arr.push(w);
        else map.set(k, [w]);
      }
    return map;
  }, [list.data, by]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // id đầy đủ của nhóm đã tải riêng để "chọn cả nhóm"
  const [fetched, setFetched] = useState<Record<string, number[]>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  // Tải thêm khi cuộn gần cuối
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage || isFetchingNextPage || typeof IntersectionObserver === 'undefined')
      return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void fetchNextPage();
      },
      { rootMargin: '0px 0px 600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const idsOf = (g: WordGroup) => {
    const ids = new Set((byKey.get(g.key) ?? []).map((w) => w.id));
    for (const id of fetched[g.key] ?? []) ids.add(id);
    return ids;
  };

  const fetchAllIds = async (g: WordGroup) => {
    const ids: number[] = [];
    for (let page = 1; ; page++) {
      const res = await wordsApi.list({
        ...filters,
        saved_from: g.from,
        saved_to: g.to,
        sort,
        page,
        per_page: 100,
      });
      ids.push(...res.data.map((w) => w.id));
      if (res.meta.current_page >= res.meta.last_page) return ids;
    }
  };

  const toggleGroup = async (g: WordGroup, allSelected: boolean) => {
    let ids = [...idsOf(g)];
    if (allSelected) {
      onSelect((prev) => {
        const n = new Set(prev);
        ids.forEach((id) => n.delete(id));
        return n;
      });
      return;
    }
    if (ids.length < g.count) {
      setLoadingKey(g.key);
      try {
        ids = await fetchAllIds(g);
        setFetched((f) => ({ ...f, [g.key]: ids }));
      } catch (e) {
        toast.show({ tone: 'error', message: (e as Error).message });
        return;
      } finally {
        setLoadingKey(null);
      }
    }
    onSelect((prev) => new Set([...prev, ...ids]));
  };

  if (list.isPending) return <Skeleton lines={6} />;

  const visible = groups.filter((g) => byKey.has(g.key));

  return (
    <>
      {/* Mỗi nhóm là một section riêng: tiêu đề dính chỉ trong phạm vi nhóm của nó, nhóm sau đẩy
          nhóm trước ra (sticky trong một <table> chung thì các tiêu đề cũ chồng lên nhau). */}
      <div className={`${styles.tableWrap} ${styles.tableWrapGrouped}`}>
        <table className={`${styles.table} ${styles.tableFixed}`}>
          <WordColumns />
          {header}
        </table>
        {visible.map((g) => {
          const words = byKey.get(g.key) ?? [];
          const known = idsOf(g);
          let sel = 0;
          known.forEach((id) => selected.has(id) && sel++);
          const all = g.count > 0 && sel >= g.count;
          const isCollapsed = collapsed.has(g.key);
          const title = groupTitle(g, by, today);
          const bodyId = `group-${g.key}`;
          return (
            <section key={g.key} className={styles.group} aria-label={title}>
              <div className={styles.groupHead}>
                <span className={styles.groupCheck}>
                  <GroupCheckbox
                    checked={all}
                    indeterminate={sel > 0 && !all}
                    disabled={loadingKey === g.key}
                    label={`Chọn cả nhóm ${title}`}
                    onChange={() => void toggleGroup(g, all)}
                  />
                </span>
                <button
                  type="button"
                  className={styles.groupToggle}
                  aria-expanded={!isCollapsed}
                  aria-controls={bodyId}
                  onClick={() =>
                    setCollapsed((c) => {
                      const n = new Set(c);
                      if (n.has(g.key)) n.delete(g.key);
                      else n.add(g.key);
                      return n;
                    })
                  }
                >
                  <UiIcon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={16} />
                  <span className={styles.groupTitle}>{title}</span>
                  <span className={styles.groupCount}>{g.count} từ</span>
                </button>
                {loadingKey === g.key && (
                  <span className={styles.groupLoading} role="status">
                    Đang tải cả nhóm…
                  </span>
                )}
              </div>
              <table
                id={bodyId}
                className={`${styles.table} ${styles.tableFixed}`}
                hidden={isCollapsed}
              >
                <WordColumns />
                <tbody>{words.map(renderRow)}</tbody>
              </table>
            </section>
          );
        })}
      </div>
      <div ref={sentinel} className={styles.loadMore}>
        {list.hasNextPage && (
          <Button
            variant="secondary"
            loading={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          >
            Tải thêm
          </Button>
        )}
      </div>
    </>
  );
}

/** Bề rộng cột cố định để bảng tiêu đề và bảng của từng nhóm thẳng cột với nhau. */
function WordColumns() {
  return (
    <colgroup>
      <col className={styles.colCheck} />
      <col className={styles.colWord} />
      <col />
      <col className={styles.colStatus} />
      <col className={styles.colActions} />
    </colgroup>
  );
}

function GroupCheckbox({
  checked,
  indeterminate,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  label: string;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
    />
  );
}
