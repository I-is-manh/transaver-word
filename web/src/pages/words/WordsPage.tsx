import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { decksApi } from '@/api/endpoints';
import { wordsApi } from '@/api/words';
import type { Word, WordKind, WordLanguage, WordSort, WordStatus } from '@/api/types';
import { useAuth } from '@/auth/authContext';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Segmented } from '@/components/Segmented';
import { UiIcon } from '@/components/UiIcon';
import { useToast } from '@/components/toastContext';
import {
  Chip,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
} from '@/components/ui';
import { useDebounced } from '@/lib/useDebounced';
import { formatDue } from '@/lib/format';
import { qk } from '@/lib/queryKeys';
import { speakWord } from '@/lib/speech';
import {
  GROUPINGS,
  isGrouping,
  languageLabels,
  readWordsView,
  saveWordsView,
  todayIn,
  type WordGrouping,
} from '@/lib/wordGroups';
import { EditWordDialog } from './EditWordDialog';
import { GroupedWordList, type WordFilters } from './GroupedWordList';
import { useWordActions } from './useWordActions';
import styles from './Words.module.css';

const SORTS: { value: WordSort; label: string }[] = [
  { value: '-created_at', label: 'Mới lưu trước' },
  { value: 'created_at', label: 'Cũ lưu trước' },
  { value: 'text', label: 'Theo chữ cái (A-Z)' },
  { value: 'due_at', label: 'Sắp đến hạn ôn' },
];
/** Khi gom nhóm theo thời gian chỉ sắp theo ngày lưu */
const GROUPED_SORTS = SORTS.slice(0, 2);

export function WordsPage() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const page = Number(params.get('page')) || 1;
  const status = (params.get('status') as WordStatus | null) ?? undefined;
  const kind = (params.get('kind') as WordKind | null) ?? undefined;
  const sortParam = (params.get('sort') as WordSort | null) ?? '-created_at';
  const deckId = Number(params.get('deck_id')) || undefined;
  const hard = params.get('hard') === '1';
  const [q, setQ] = useState(params.get('q') ?? '');
  const debouncedQ = useDebounced(q.trim());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Word | null>(null);
  const { setStatus, remove } = useWordActions();

  // Ngôn ngữ + cách nhóm: nằm trên URL (?lang=&group=), lần đầu vào trang lấy lại từ localStorage
  const [stored] = useState(() =>
    params.has('lang') || params.has('group') ? {} : readWordsView(),
  );
  const [synced, setSynced] = useState(false);
  const groupParam = params.get('group');
  const group: WordGrouping = isGrouping(groupParam)
    ? groupParam
    : synced
      ? 'day'
      : (stored.group ?? 'day');
  const langParam = params.get('lang') ?? (synced ? undefined : stored.lang);

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (!synced && (stored.lang || (stored.group && stored.group !== 'day')))
      update({
        lang: stored.lang,
        group: stored.group && stored.group !== 'day' ? stored.group : undefined,
      });
    setSynced(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if ((params.get('q') ?? '') !== debouncedQ) update({ q: debouncedQ || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const languages = useQuery({
    queryKey: [...qk.words, 'languages'],
    queryFn: () => wordsApi.languages().then((r) => r.data),
  });
  // Ngôn ngữ đã chọn không còn từ nào → coi như "Tất cả"
  const lang =
    langParam && (!languages.data || languages.data.some((l) => l.lang === langParam))
      ? langParam
      : undefined;

  useEffect(() => {
    if (synced) saveWordsView({ lang, group });
  }, [synced, lang, group]);

  const grouped = group !== 'none';
  const sort: WordSort =
    grouped && sortParam !== 'created_at' && sortParam !== '-created_at'
      ? '-created_at'
      : sortParam;

  const filters: WordFilters = {
    q: params.get('q') || undefined,
    status,
    kind,
    deck_id: deckId,
    hard: hard ? (1 as const) : undefined,
    lang,
  };
  const listParams = { ...filters, sort, page, per_page: 20 };
  const words = useQuery({
    queryKey: [...qk.words, 'list', listParams],
    queryFn: () => wordsApi.list(listParams),
    placeholderData: keepPreviousData,
    enabled: !grouped,
  });
  const order = sort === 'created_at' ? 'asc' : 'desc';
  const groups = useQuery({
    queryKey: [...qk.words, 'groups', { ...filters, by: group, order }],
    queryFn: () =>
      grouped ? wordsApi.groups({ ...filters, by: group, order }).then((r) => r.data) : [],
    placeholderData: keepPreviousData,
    enabled: grouped,
  });
  const decks = useQuery({
    queryKey: qk.decks,
    queryFn: () => decksApi.list().then((r) => r.data),
  });

  useEffect(() => setSelected(new Set()), [params]);

  const addToDeck = useMutation({
    mutationFn: ({ id, ids }: { id: number; ids: number[] }) => decksApi.addWords(id, ids),
    onSuccess: ({ deck }, { ids }) => {
      void qc.invalidateQueries({ queryKey: qk.words });
      void qc.invalidateQueries({ queryKey: qk.decks });
      toast.show({ tone: 'success', message: `Đã thêm ${ids.length} từ vào deck "${deck.name}".` });
      setSelected(new Set());
    },
    onError: (e) => toast.show({ tone: 'error', message: (e as Error).message }),
  });

  const rows = words.data?.data ?? [];
  const allChecked = rows.length > 0 && rows.every((w) => selected.has(w.id));

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const filtered = !!(params.get('q') || status || kind || deckId || hard);
  const total = grouped
    ? groups.data?.reduce((sum, g) => sum + g.count, 0)
    : words.data?.meta.total;
  const current = grouped ? groups : words;
  const empty = grouped ? groups.data?.length === 0 : rows.length === 0;
  const today = todayIn(user?.timezone);

  const renderRow = (w: Word) => (
    <WordRow
      key={w.id}
      word={w}
      checked={selected.has(w.id)}
      onCheck={() => toggle(w.id)}
      onToggleKnown={() =>
        setStatus.mutate({
          word: w,
          status: w.status === 'known' ? 'learning' : 'known',
        })
      }
      onEdit={() => setEditing(w)}
      onDelete={() => remove.mutate(w)}
    />
  );

  /** Không nhóm: ô chọn cả trang; gom nhóm: mỗi tiêu đề nhóm có ô "chọn cả nhóm" riêng. */
  const thead = (selectAll?: { checked: boolean; onToggle: () => void }) => (
    <thead>
      <tr>
        <th className={styles.checkCol}>
          {selectAll ? (
            <input
              type="checkbox"
              aria-label="Chọn tất cả từ trên trang"
              checked={selectAll.checked}
              onChange={selectAll.onToggle}
            />
          ) : (
            <span className="sr-only">Chọn</span>
          )}
        </th>
        <th>Từ</th>
        <th>Nghĩa</th>
        <th>Trạng thái</th>
        <th className={styles.actionsCol}>
          <span className="sr-only">Thao tác</span>
        </th>
      </tr>
    </thead>
  );

  return (
    <>
      <PageHeader
        title="Từ của tôi"
        subtitle={total !== undefined ? `${total} từ${filtered ? ' khớp bộ lọc' : ''}` : undefined}
        actions={
          <>
            <Link to="/decks" className={styles.headerLink}>
              <Icon name="deck" size={18} /> Deck
            </Link>
            <Link to="/words/trash" className={styles.headerLink}>
              <UiIcon name="trash" size={18} /> Thùng rác
            </Link>
          </>
        }
      />

      <div className={styles.viewBar}>
        {languages.data && languages.data.length > 1 ? (
          <LanguageTabs
            languages={languages.data}
            value={lang}
            onChange={(v) => update({ lang: v })}
          />
        ) : (
          <span />
        )}
        <div className={styles.groupBy}>
          <span className={styles.groupByLabel} aria-hidden="true">
            Nhóm theo
          </span>
          <Segmented
            label="Nhóm theo"
            showLabel={false}
            size="sm"
            options={GROUPINGS}
            value={group}
            onChange={(v) => update({ group: v === 'day' ? undefined : v })}
          />
        </div>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Icon name="search" size={18} />
          <span className="sr-only">Tìm từ</span>
          <input
            type="search"
            placeholder="Tìm theo từ hoặc nghĩa…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <Select
          label="Trạng thái"
          value={hard ? 'hard' : (status ?? '')}
          onChange={(e) => {
            const v = e.target.value;
            update({
              status: v === 'learning' || v === 'known' ? v : undefined,
              hard: v === 'hard' ? '1' : undefined,
            });
          }}
        >
          <option value="">Tất cả</option>
          <option value="learning">Đang học</option>
          <option value="known">Đã biết</option>
          <option value="hard">Từ khó</option>
        </Select>
        <Select label="Loại" value={kind ?? ''} onChange={(e) => update({ kind: e.target.value })}>
          <option value="">Từ và cụm từ</option>
          <option value="word">Chỉ từ</option>
          <option value="phrase">Chỉ cụm từ</option>
        </Select>
        <Select
          label="Deck"
          value={deckId ?? ''}
          onChange={(e) => update({ deck_id: e.target.value })}
        >
          <option value="">Mọi deck</option>
          {(decks.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select label="Sắp xếp" value={sort} onChange={(e) => update({ sort: e.target.value })}>
          {(grouped ? GROUPED_SORTS : SORTS).map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {selected.size > 0 && (
        <div className={styles.bulk} role="region" aria-label="Thao tác với từ đã chọn">
          <span>Đã chọn {selected.size} từ</span>
          {(decks.data ?? []).length > 0 ? (
            <select
              className={styles.bulkSelect}
              aria-label="Thêm vào deck"
              value=""
              disabled={addToDeck.isPending}
              onChange={(e) => {
                const id = Number(e.target.value);
                if (id) addToDeck.mutate({ id, ids: [...selected] });
              }}
            >
              <option value="">Thêm vào deck…</option>
              {(decks.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          ) : (
            <Link to="/decks">Tạo deck để xếp từ</Link>
          )}
          <Button variant="ghost" onClick={() => setSelected(new Set())}>
            Bỏ chọn
          </Button>
        </div>
      )}

      {current.isPending ? (
        <Skeleton lines={6} />
      ) : current.isError ? (
        <ErrorState error={current.error} onRetry={() => void current.refetch()} />
      ) : empty ? (
        filtered || lang ? (
          <EmptyState title="Không có từ nào khớp">
            Thử bỏ bớt bộ lọc hoặc từ khóa tìm kiếm.
          </EmptyState>
        ) : (
          <EmptyState title="Chưa có từ nào">
            Bôi đen một từ trên trang web bất kỳ, bấm icon Transaver rồi bấm <strong>Lưu</strong>.
            Từ sẽ hiện ở đây kèm câu bạn đã gặp.
          </EmptyState>
        )
      ) : grouped ? (
        <GroupedWordList
          // đổi cách nhóm/bộ lọc thì làm mới trạng thái thu gọn và id đã tải của nhóm
          key={JSON.stringify([group, order, filters])}
          filters={filters}
          by={group}
          order={order}
          groups={groups.data ?? []}
          today={today}
          selected={selected}
          onSelect={setSelected}
          renderRow={renderRow}
          header={thead()}
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            {thead({
              checked: allChecked,
              onToggle: () => setSelected(allChecked ? new Set() : new Set(rows.map((w) => w.id))),
            })}
            <tbody>{rows.map(renderRow)}</tbody>
          </table>
        </div>
      )}

      {editing && <EditWordDialog word={editing} onClose={() => setEditing(null)} />}

      {!grouped && words.data && (
        <Pagination
          page={words.data.meta.current_page}
          lastPage={words.data.meta.last_page}
          total={words.data.meta.total}
          onPage={(p) => update({ page: String(p) })}
        />
      )}
    </>
  );
}

function LanguageTabs({
  languages,
  value,
  onChange,
}: {
  languages: WordLanguage[];
  value: string | undefined;
  onChange: (lang: string | undefined) => void;
}) {
  const labels = useMemo(() => languageLabels(languages.map((l) => l.lang)), [languages]);
  const total = languages.reduce((s, l) => s + l.count, 0);
  const tabs = [
    { lang: undefined, label: 'Tất cả', count: total },
    ...languages.map((l) => ({
      lang: l.lang,
      label: labels.get(l.lang) ?? l.lang,
      count: l.count,
    })),
  ];
  return (
    <div className={styles.langTabs} role="group" aria-label="Lọc theo ngôn ngữ">
      {tabs.map((t) => (
        <button
          key={t.lang ?? 'all'}
          type="button"
          className={styles.langTab}
          aria-pressed={value === t.lang}
          onClick={() => onChange(t.lang)}
        >
          <span>{t.label}</span>
          <span className={styles.langCount}>{t.count}</span>
        </button>
      ))}
    </div>
  );
}

function WordRow({
  word,
  checked,
  onCheck,
  onToggleKnown,
  onEdit,
  onDelete,
}: {
  word: Word;
  checked: boolean;
  onCheck: () => void;
  onToggleKnown: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className={checked ? styles.rowChecked : undefined}>
      <td className={styles.checkCol}>
        <input
          type="checkbox"
          aria-label={`Chọn "${word.text}"`}
          checked={checked}
          onChange={onCheck}
        />
      </td>
      <td>
        <div className={styles.wordCell}>
          <button
            type="button"
            className={styles.speak}
            onClick={() => speakWord(word)}
            aria-label={`Nghe phát âm "${word.text}"`}
            title="Nghe phát âm"
          >
            <Icon name="audio" size={16} />
          </button>
          <div>
            <Link to={`/words/${word.id}`} className={styles.wordLink}>
              {word.text}
            </Link>
            {(word.phonetic || word.kind === 'phrase') && (
              <div className={styles.meta}>{word.phonetic ?? 'cụm từ'}</div>
            )}
          </div>
        </div>
      </td>
      <td className={word.meaning ? undefined : styles.muted}>
        {word.meaning ?? 'Chưa chọn nghĩa'}
      </td>
      <td>
        <div className={styles.statusCell}>
          {word.status === 'known' ? (
            <Chip>Đã biết</Chip>
          ) : word.is_mastered ? (
            <Chip tone="brand">Đã thuộc</Chip>
          ) : word.lapses >= 3 ? (
            <Chip tone="accent">Từ khó</Chip>
          ) : (
            <Chip tone="info">Đang học</Chip>
          )}
          {word.status === 'learning' && (
            <span className={styles.meta}>{formatDue(word.due_at)}</span>
          )}
        </div>
      </td>
      <td className={styles.actionsCol}>
        <div className={styles.rowActions}>
          <IconButton
            icon="pencil"
            label="Sửa"
            aria-label={`Sửa "${word.text}"`}
            onClick={onEdit}
          />
          <IconButton
            icon="check"
            label={word.status === 'known' ? 'Học lại' : 'Đã biết'}
            // nút bật/tắt: nhãn cố định, trạng thái nằm ở aria-pressed
            aria-label={`Đã biết "${word.text}"`}
            pressed={word.status === 'known'}
            onClick={onToggleKnown}
          />
          <IconButton
            icon="trash"
            tone="danger"
            label="Xóa"
            aria-label={`Xóa "${word.text}"`}
            tipAlign="end"
            onClick={onDelete}
          />
        </div>
      </td>
    </tr>
  );
}
