import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { decksApi } from '@/api/endpoints';
import type { Context, MeaningCandidate, Word } from '@/api/types';
import { dictionaryApi, wordsApi } from '@/api/words';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { UiIcon } from '@/components/UiIcon';
import { MarkedSentence } from '@/components/MarkedSentence';
import { useToast } from '@/components/toastContext';
import { Chip, ErrorState, PageHeader, Panel, Skeleton } from '@/components/ui';
import { formatDate, formatDue, posLabel } from '@/lib/format';
import { qk } from '@/lib/queryKeys';
import { speakWord } from '@/lib/speech';
import { EditWordDialog } from './EditWordDialog';
import { useWordActions } from './useWordActions';
import styles from './WordDetail.module.css';
import { ArrowIcon } from '@/components/ArrowIcon';

export function WordDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const detail = useQuery({ queryKey: qk.word(id), queryFn: () => wordsApi.get(id) });
  const { setStatus, remove, restore } = useWordActions();
  const [editing, setEditing] = useState(false);

  if (detail.isPending) return <Skeleton lines={8} />;
  if (detail.isError) {
    if (detail.error instanceof ApiError && detail.error.status === 404)
      return (
        <PageHeader
          title="Không tìm thấy từ"
          subtitle="Từ này không tồn tại hoặc đã bị xóa hẳn."
          back={
            <Link to="/words">
              <ArrowIcon dir="left" />
              Từ của tôi
            </Link>
          }
        />
      );
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  }

  const { word, contexts } = detail.data;
  const trashed = !!word.deleted_at;

  return (
    <>
      <PageHeader
        back={
          <Link to={trashed ? '/words/trash' : '/words'}>
            <ArrowIcon dir="left" />
            {trashed ? 'Thùng rác' : 'Từ của tôi'}
          </Link>
        }
        title={
          <span className={styles.title}>
            {word.text}
            <button
              type="button"
              className={styles.speak}
              onClick={() => speakWord(word)}
              aria-label="Nghe phát âm"
              title="Nghe phát âm"
            >
              <Icon name="audio" size={22} />
            </button>
          </span>
        }
        subtitle={
          <span className={styles.sub}>
            {word.phonetic && <span>{word.phonetic}</span>}
            {word.part_of_speech && <span>{posLabel(word.part_of_speech)}</span>}
            {word.kind === 'phrase' && <span>cụm từ</span>}
            <span>Lưu ngày {formatDate(word.created_at)}</span>
          </span>
        }
        actions={
          trashed ? (
            <Button onClick={() => restore.mutate(word.id)} loading={restore.isPending}>
              {!restore.isPending && <UiIcon name="rotate-ccw" />}
              Khôi phục
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <UiIcon name="pencil" />
                Sửa
              </Button>
              <Button
                variant="secondary"
                loading={setStatus.isPending}
                onClick={() =>
                  setStatus.mutate({ word, status: word.status === 'known' ? 'learning' : 'known' })
                }
              >
                {!setStatus.isPending && (
                  <UiIcon name={word.status === 'known' ? 'rotate-ccw' : 'check'} />
                )}
                {word.status === 'known' ? 'Học lại từ này' : 'Đánh dấu đã biết'}
              </Button>
              <Button
                variant="ghost"
                className={styles.danger}
                onClick={() => remove.mutate(word, { onSuccess: () => navigate('/words') })}
              >
                <UiIcon name="trash" />
                Xóa
              </Button>
            </>
          )
        }
      />

      {trashed && (
        <p className={styles.notice} role="status">
          Từ này đang trong thùng rác và sẽ tự xóa hẳn sau 30 ngày.
        </p>
      )}

      <div className={styles.grid}>
        <div className={styles.main}>
          <MeaningPanel word={word} />
          <Panel title={`Câu bạn đã gặp (${contexts.length})`}>
            <ul className={styles.contexts}>
              {contexts.map((c) => (
                <ContextItem
                  key={c.id}
                  word={word}
                  context={c}
                  canDelete={contexts.length > 1 && !trashed}
                  disabled={trashed}
                />
              ))}
            </ul>
          </Panel>
        </div>
        <aside className={styles.side}>
          <Panel title="Tiến độ">
            <dl className={styles.facts}>
              <dt>Trạng thái</dt>
              <dd>
                {word.status === 'known' ? (
                  <Chip>Đã biết</Chip>
                ) : word.is_mastered ? (
                  <Chip tone="brand">Đã thuộc</Chip>
                ) : (
                  <Chip tone="info">Đang học</Chip>
                )}
              </dd>
              <dt>Lần ôn tới</dt>
              <dd>{word.status === 'known' ? 'Không ôn' : formatDue(word.due_at)}</dd>
              <dt>Số lần quên</dt>
              <dd>
                {word.lapses}
                {word.lapses >= 3 && word.status === 'learning' && (
                  <>
                    {' '}
                    <Chip tone="accent">Từ khó</Chip>
                  </>
                )}
              </dd>
            </dl>
          </Panel>
          {!trashed && <DeckPanel word={word} />}
          <DictionaryPanel word={word} />
        </aside>
      </div>

      {editing && !trashed && <EditWordDialog word={word} onClose={() => setEditing(false)} />}
    </>
  );
}

function MeaningPanel({ word }: { word: Word }) {
  return (
    <Panel title="Nghĩa chính">
      <p className={word.meaning ? styles.meaning : styles.meaningEmpty}>
        {word.meaning ?? 'Chưa chọn nghĩa. Chọn một nghĩa ở câu bên dưới hoặc bấm Sửa để tự gõ.'}
      </p>
      {word.note && (
        <div className={styles.note}>
          <span className={styles.label}>Ghi chú</span>
          <p className={styles.noteText}>{word.note}</p>
        </div>
      )}
    </Panel>
  );
}

function ContextItem({
  word,
  context,
  canDelete,
  disabled,
}: {
  word: Word;
  context: Context;
  canDelete: boolean;
  disabled: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [picking, setPicking] = useState(false);
  const [custom, setCustom] = useState('');
  const candidates = useQuery({
    queryKey: ['words', 'candidates', word.id],
    queryFn: () => wordsApi.meaningCandidates(word.id).then((r) => r.meaning_candidates),
    enabled: picking,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: qk.words });
  const setMeaning = useMutation({
    mutationFn: (body: {
      meaning: string;
      meaning_source: 'dictionary' | 'user' | 'translation';
    }) => wordsApi.updateContext(word.id, context.id, body),
    onSuccess: () => {
      refresh();
      setPicking(false);
      setCustom('');
    },
    onError: (e) => toast.show({ tone: 'error', message: (e as Error).message }),
  });
  const del = useMutation({
    mutationFn: () => wordsApi.removeContext(word.id, context.id),
    onSuccess: () => {
      refresh();
      toast.show({ message: 'Đã xóa câu.' });
    },
    onError: (e) => toast.show({ tone: 'error', message: (e as Error).message }),
  });

  let host = '';
  try {
    host = context.page_url ? new URL(context.page_url).host : '';
  } catch {
    host = '';
  }

  const choose = (c: MeaningCandidate) =>
    setMeaning.mutate({ meaning: c.text, meaning_source: c.source });

  return (
    <li className={styles.context}>
      <blockquote className={styles.sentence}>
        <MarkedSentence
          sentence={context.sentence}
          offset={context.word_offset}
          length={context.word_length}
        />
      </blockquote>
      <div className={styles.contextMeta}>
        {context.page_url ? (
          <a href={context.page_url} target="_blank" rel="noreferrer noopener">
            {context.page_title || host}
          </a>
        ) : (
          <span>Không lưu link trang</span>
        )}
        <span>· {formatDate(context.created_at)}</span>
      </div>
      <div className={styles.contextMeaning}>
        <span className={styles.label}>Nghĩa trong câu này:</span>{' '}
        {context.meaning ? (
          <strong>{context.meaning}</strong>
        ) : (
          <em className={styles.mutedText}>chưa chọn</em>
        )}
        {!disabled && (
          <span className={styles.contextActions}>
            <Button variant="ghost" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
              <UiIcon name={picking ? 'x' : 'pencil'} size={16} />
              {picking ? 'Đóng' : 'Đổi nghĩa'}
            </Button>
            {canDelete && (
              <Button
                variant="ghost"
                className={styles.danger}
                loading={del.isPending}
                onClick={() => del.mutate()}
              >
                {!del.isPending && <UiIcon name="trash" size={16} />}
                Xóa câu
              </Button>
            )}
          </span>
        )}
      </div>
      {picking && (
        <div className={styles.picker}>
          {candidates.isPending ? (
            <Skeleton lines={2} />
          ) : (
            <ul className={styles.candidates}>
              {(candidates.data ?? []).map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    className={styles.candidate}
                    onClick={() => choose(c)}
                    disabled={setMeaning.isPending}
                  >
                    <span>
                      {c.part_of_speech && <em>{posLabel(c.part_of_speech)} · </em>}
                      {c.text}
                    </span>
                    {c.example && <span className={styles.example}>Ví dụ: {c.example}</span>}
                  </button>
                </li>
              ))}
              {candidates.data?.length === 0 && (
                <li className={styles.mutedText}>Từ điển không có gợi ý cho từ này.</li>
              )}
            </ul>
          )}
          <form
            className={styles.customForm}
            onSubmit={(e) => {
              e.preventDefault();
              if (custom.trim())
                setMeaning.mutate({ meaning: custom.trim(), meaning_source: 'user' });
            }}
          >
            <label className="sr-only" htmlFor={`custom-${context.id}`}>
              Tự gõ nghĩa
            </label>
            <input
              id={`custom-${context.id}`}
              className={styles.input}
              placeholder="Hoặc tự gõ nghĩa…"
              value={custom}
              maxLength={500}
              onChange={(e) => setCustom(e.target.value)}
            />
            <Button type="submit" variant="secondary" loading={setMeaning.isPending}>
              Lưu
            </Button>
          </form>
        </div>
      )}
    </li>
  );
}

function DeckPanel({ word }: { word: Word }) {
  const qc = useQueryClient();
  const toast = useToast();
  const decks = useQuery({
    queryKey: qk.decks,
    queryFn: () => decksApi.list().then((r) => r.data),
  });
  const toggle = useMutation({
    mutationFn: ({ deckId, add }: { deckId: number; add: boolean }) =>
      add ? decksApi.addWords(deckId, [word.id]) : decksApi.removeWords(deckId, [word.id]),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.words });
      void qc.invalidateQueries({ queryKey: qk.decks });
    },
    onError: (e) => toast.show({ tone: 'error', message: (e as Error).message }),
  });
  return (
    <Panel title="Deck">
      {decks.data?.length ? (
        <ul className={styles.deckList}>
          {decks.data.map((d) => (
            <li key={d.id}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={word.deck_ids.includes(d.id)}
                  disabled={toggle.isPending}
                  onChange={(e) => toggle.mutate({ deckId: d.id, add: e.target.checked })}
                />
                {d.name}
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.mutedText}>
          Chưa có deck. <Link to="/decks">Tạo deck</Link> để nhóm từ theo chủ đề.
        </p>
      )}
    </Panel>
  );
}

function DictionaryPanel({ word }: { word: Word }) {
  const lookup = useQuery({
    queryKey: ['dictionary', word.normalized_text, word.source_lang],
    queryFn: () =>
      dictionaryApi.lookup(word.normalized_text, word.source_lang).then((r) => r.entry),
    staleTime: Infinity,
  });
  if (!lookup.data) return null;
  return (
    <Panel title="Từ điển Anh – Anh">
      <ul className={styles.defs}>
        {lookup.data.meanings.slice(0, 4).map((m, i) => (
          <li key={i}>
            <em>{posLabel(m.part_of_speech)}</em> {m.definition}
            {m.example && <span className={styles.example}>“{m.example}”</span>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
