import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Card, CardDisplay, Rating } from '@/api/types';
import { dictionaryApi } from '@/api/words';
import { Icon } from '@/components/Icon';
import { MarkedSentence } from '@/components/MarkedSentence';
import { sentenceIsWord } from '@/lib/sentence';
import { formatInterval, posLabel } from '@/lib/format';
import { speakWord } from '@/lib/speech';
import styles from './Review.module.css';

import type { Outcome } from './reviewUtils';

const RATING_LABEL: Record<Rating, string> = { 1: 'Quên', 2: 'Khó', 3: 'Được', 4: 'Dễ' };

function AudioButton({ card, big = false }: { card: Card; big?: boolean }) {
  return (
    <button
      type="button"
      className={big ? styles.audioBig : styles.audio}
      onClick={(e) => {
        e.stopPropagation();
        speakWord(card.word);
      }}
      aria-label="Nghe phát âm"
      title="Nghe phát âm"
    >
      <Icon name="audio" size={big ? 32 : 20} />
    </button>
  );
}

/** 4 nút đánh giá (flashcard) hoặc 3 nút Khó/Được/Dễ (sau khi trả lời đúng). */
export function RatingButtons({
  card,
  ratings,
  onRate,
  defaultRating,
}: {
  card: Card;
  ratings: Rating[];
  onRate: (r: Rating) => void;
  defaultRating?: Rating;
}) {
  const defRef = useRef<HTMLButtonElement>(null);
  useEffect(() => defRef.current?.focus(), []);
  return (
    <div className={styles.ratings} role="group" aria-label="Bạn nhớ từ này thế nào?">
      {ratings.map((r) => (
        <button
          key={r}
          ref={r === defaultRating ? defRef : undefined}
          type="button"
          className={`${styles.rating} ${styles[`rating${r}`]}`}
          onClick={() => onRate(r)}
          aria-keyshortcuts={String(r)}
        >
          <span className={styles.ratingLabel}>
            {RATING_LABEL[r]} <kbd>{r}</kbd>
          </span>
          <span className={styles.ratingInterval}>
            {formatInterval(card.intervals[String(r) as '1'])}
          </span>
        </button>
      ))}
    </div>
  );
}

function EnglishDefinition({ card }: { card: Card }) {
  const q = useQuery({
    queryKey: ['dictionary', card.word.normalized_text, card.word.source_lang],
    queryFn: () =>
      dictionaryApi.lookup(card.word.normalized_text, card.word.source_lang).then((r) => r.entry),
    staleTime: Infinity,
  });
  const m = q.data?.meanings[0];
  if (!m) return null;
  return (
    <p className={styles.definition}>
      <em>{posLabel(m.part_of_speech)}</em> {m.definition}
    </p>
  );
}

// ---------------------------------------------------------------- Flashcard

export function FlashcardView({
  card,
  display,
  flipped,
  onFlip,
  cardRef,
}: {
  card: Card;
  display: CardDisplay;
  flipped: boolean;
  onFlip: () => void;
  cardRef: React.RefObject<HTMLDivElement>;
}) {
  const w = card.word;
  return (
    <div
      ref={cardRef}
      className={`tv-card ${styles.flashcard} ${flipped ? 'is-flipped' : ''}`}
      data-tv-flip="flip3d"
      role="button"
      tabIndex={0}
      aria-label={flipped ? `Mặt sau: ${w.meaning ?? ''}` : `Từ ${w.text}. Bấm để lật thẻ`}
      onClick={() => !flipped && onFlip()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !flipped) {
          e.preventDefault();
          onFlip();
        }
      }}
    >
      <div className={`tv-card__face tv-card__front ${styles.face}`} aria-hidden={flipped}>
        <span className={styles.kind}>Thẻ ghi nhớ</span>
        <p className={styles.word}>{w.text}</p>
        {display.phonetic && w.phonetic && <p className={styles.phonetic}>{w.phonetic}</p>}
        <AudioButton card={card} />
        <p className={styles.hint}>
          Nhớ nghĩa trong đầu rồi bấm thẻ hoặc phím <kbd>Space</kbd> để lật
        </p>
      </div>
      <div className={`tv-card__face tv-card__back ${styles.face}`} aria-hidden={!flipped}>
        <p className={styles.wordSmall}>
          {w.text}{' '}
          {display.phonetic && w.phonetic && <span className={styles.phonetic}>{w.phonetic}</span>}
        </p>
        <p className={styles.meaning}>{w.meaning ?? 'Chưa có nghĩa'}</p>
        {display.english_definition && flipped && <EnglishDefinition card={card} />}
        {display.context_sentence &&
          card.context &&
          !sentenceIsWord(card.context.sentence, w.text) && (
            <blockquote className={styles.sentence}>
              <MarkedSentence
                sentence={card.context.sentence}
                offset={card.context.word_offset}
                length={card.context.word_length}
              />
            </blockquote>
          )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- MCQ + Listening

export function ChoiceView({
  card,
  outcome,
  picked,
  onPick,
  cardRef,
}: {
  card: Card;
  outcome: Outcome | null;
  picked: string | null;
  onPick: (key: string) => void;
  cardRef: React.RefObject<HTMLDivElement>;
}) {
  const listening = card.exercise_type === 'listening';
  useEffect(() => {
    if (listening) speakWord(card.word);
  }, [listening, card]);
  return (
    <div ref={cardRef} className={styles.panelCard}>
      <span className={styles.kind}>{listening ? 'Nghe và chọn nghĩa' : 'Chọn nghĩa đúng'}</span>
      {listening ? (
        <div className={styles.listenRow}>
          <AudioButton card={card} big />
          {outcome && <p className={styles.word}>{card.word.text}</p>}
        </div>
      ) : (
        <>
          <p className={styles.word}>{card.word.text}</p>
          {card.word.phonetic && <p className={styles.phonetic}>{card.word.phonetic}</p>}
        </>
      )}
      <div className={styles.options} role="radiogroup" aria-label="Các phương án">
        {(card.options ?? []).map((o, i) => {
          const isAnswer = o.key === card.answer_key;
          const state = !outcome
            ? ''
            : isAnswer
              ? styles.optCorrect
              : o.key === picked
                ? styles.optWrong
                : styles.optDim;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={picked === o.key}
              className={`${styles.option} ${state}`}
              disabled={!!outcome}
              onClick={() => onPick(o.key)}
            >
              <kbd>{i + 1}</kbd> {o.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Cloze + Dictation

export function TypingView({
  card,
  outcome,
  onSubmit,
  cardRef,
}: {
  card: Card;
  outcome: Outcome | null;
  onSubmit: (answer: string) => void;
  cardRef: React.RefObject<HTMLDivElement>;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dictation = card.exercise_type === 'dictation';
  useEffect(() => {
    setValue('');
    inputRef.current?.focus();
    if (dictation) speakWord(card.word);
  }, [card, dictation]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (outcome || !value.trim()) return;
    onSubmit(value);
  };

  const input = (
    <input
      ref={inputRef}
      className={`${styles.blank} ${outcome ? (outcome.correct ? styles.blankOk : styles.blankBad) : ''}`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      readOnly={!!outcome}
      aria-label={dictation ? 'Gõ lại từ bạn nghe được' : 'Từ còn thiếu'}
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
      size={Math.max(6, (card.answer_text ?? '').length + 2)}
    />
  );

  let body: ReactNode;
  if (dictation) {
    body = (
      <>
        <span className={styles.kind}>Nghe và gõ lại từ</span>
        <div className={styles.listenRow}>
          <AudioButton card={card} big />
        </div>
        <div className={styles.dictationInput}>{input}</div>
      </>
    );
  } else {
    body = (
      <>
        <span className={styles.kind}>Điền từ còn thiếu vào câu bạn đã gặp</span>
        <p className={styles.clozeSentence}>
          {card.cloze?.before}
          {input}
          {card.cloze?.after}
        </p>
        <p className={styles.clue}>
          Nghĩa: {card.word.meaning}
          {card.cloze?.hint && <> · Bắt đầu bằng “{card.cloze.hint}”</>}
        </p>
      </>
    );
  }
  return (
    <form
      ref={cardRef as unknown as React.RefObject<HTMLFormElement>}
      className={styles.panelCard}
      onSubmit={submit}
    >
      {body}
      {outcome && !outcome.correct && (
        <p className={styles.reveal}>
          Đáp án: <strong>{card.answer_text}</strong>
        </p>
      )}
      {!outcome && (
        <button type="submit" className={styles.check} disabled={!value.trim()}>
          Kiểm tra <kbd>Enter</kbd>
        </button>
      )}
    </form>
  );
}
