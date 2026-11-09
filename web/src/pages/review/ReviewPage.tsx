import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { reviewApi, settingsApi } from '@/api/endpoints';
import type {
  AnswerResponse,
  Card,
  FinishSessionResponse,
  Rating,
  ReviewMode,
  StartSessionResponse,
} from '@/api/types';
import { Button } from '@/components/Button';
import { useToast } from '@/components/toastContext';
import { useRewards } from '@/components/useRewards';
import { EmptyState, ErrorState, ProgressBar, Skeleton } from '@/components/ui';
import { qk } from '@/lib/queryKeys';
import { uuid } from '@/lib/uuid';
import { ChoiceView, FlashcardView, RatingButtons, TypingView } from './cards';
import { playFeedback, sameAnswer, type Outcome } from './reviewUtils';
import { ReviewSummary } from './ReviewSummary';
import { useAnswerQueue } from './useAnswerQueue';
import styles from './Review.module.css';

const DEFAULT_DISPLAY = { phonetic: true, english_definition: false, context_sentence: true };

type Phase =
  | { kind: 'question' }
  | { kind: 'flipped' } // flashcard đã lật, chờ chấm 1–4
  | { kind: 'answered'; outcome: Outcome; picked: string | null };

export function ReviewPage() {
  const [params] = useSearchParams();
  const mode = (params.get('mode') as ReviewMode | null) ?? 'daily';
  const deckId = mode === 'deck' ? Number(params.get('deck_id')) || null : null;
  const qc = useQueryClient();
  const toast = useToast();
  const rewards = useRewards();
  const navigate = useNavigate();

  const settings = useQuery({
    queryKey: qk.settings,
    queryFn: () => settingsApi.get().then((r) => r.settings),
    staleTime: 60_000,
  });
  const display = settings.data?.card_display ?? DEFAULT_DISPLAY;

  const [start, setStart] = useState<StartSessionResponse | null>(null);
  const [startError, setStartError] = useState<unknown>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: 'question' });
  const [xp, setXp] = useState(0);
  const [result, setResult] = useState<FinishSessionResponse | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const startedFor = useRef<string | null>(null);

  // Bắt đầu buổi ôn (một lần cho mỗi lượt; StrictMode gọi effect hai lần nên chặn bằng ref)
  useEffect(() => {
    const key = `${mode}-${deckId}-${attempt}`;
    if (startedFor.current === key) return;
    startedFor.current = key;
    setStart(null);
    setStartError(null);
    setResult(null);
    setIndex(0);
    setXp(0);
    setPhase({ kind: 'question' });
    reviewApi.start({ mode, deck_id: deckId }).then(setStart).catch(setStartError);
  }, [mode, deckId, attempt]);

  const onResult = useCallback(
    (res: AnswerResponse) => {
      setXp((x) => x + res.xp_earned);
      rewards(res.new_achievements);
      if (res.became_mastered)
        toast.show({ tone: 'reward', message: `Bạn đã thuộc vững "${res.word.text}"! +50 XP` });
    },
    [rewards, toast],
  );
  const onGiveUp = useCallback(
    () =>
      toast.show({
        tone: 'error',
        message: 'Chưa gửi được một kết quả do mất mạng. Sẽ thử lại khi kết thúc buổi ôn.',
      }),
    [toast],
  );
  const queue = useAnswerQueue(onResult, onGiveUp);
  const uuids = useRef(new Map<string, string>());

  const cards = start?.cards ?? [];
  const card: Card | undefined = cards[index];

  const finish = useCallback(async () => {
    if (!start || finishing) return;
    setFinishing(true);
    const allSent = await queue.flush();
    try {
      const res = await reviewApi.finish(start.session.id);
      setResult(res);
      rewards(res.new_achievements);
      if (!allSent)
        toast.show({
          tone: 'error',
          message: 'Một vài kết quả chưa gửi được. Kiểm tra kết nối mạng.',
        });
    } catch (err) {
      toast.show({ tone: 'error', message: (err as Error).message });
    } finally {
      setFinishing(false);
      void qc.invalidateQueries({ queryKey: qk.stats });
      void qc.invalidateQueries({ queryKey: qk.words });
      void qc.invalidateQueries({ queryKey: qk.decks });
    }
  }, [start, finishing, queue, rewards, toast, qc]);

  // Không còn thẻ nào → đóng buổi ngay để server ghi nhận
  useEffect(() => {
    if (start && start.cards.length === 0 && !result && !finishing) void finish();
  }, [start, result, finishing, finish]);

  const submit = useCallback(
    (rating: Rating, isCorrect: boolean | null, answer: string | null) => {
      if (!start || !card) return;
      let id = uuids.current.get(card.card_id + ':' + index);
      if (!id) {
        id = uuid();
        uuids.current.set(card.card_id + ':' + index, id);
      }
      queue.send({
        client_uuid: id,
        session_id: start.session.id,
        user_word_id: card.word.id,
        exercise_type: card.exercise_type,
        rating,
        is_correct: isCorrect,
        answer: answer ? answer.slice(0, 255) : null,
        word_context_id: card.context?.id ?? null,
      });
    },
    [start, card, index, queue],
  );

  const next = useCallback(() => {
    if (index + 1 >= cards.length) {
      setIndex(cards.length);
      void finish();
    } else {
      setIndex((i) => i + 1);
      setPhase({ kind: 'question' });
    }
  }, [index, cards.length, finish]);

  /** Flashcard: chấm 1–4. Bài có đúng/sai: sau khi đúng, chấm 2–4. */
  const rate = useCallback(
    (rating: Rating) => {
      if (!card) return;
      if (card.exercise_type === 'flashcard') {
        submit(rating, null, null);
      } else if (phase.kind === 'answered' && phase.outcome.correct) {
        submit(rating, true, phase.outcome.answer);
      }
      next();
    },
    [card, phase, submit, next],
  );

  const answer = useCallback(
    (outcome: Outcome, picked: string | null = null) => {
      setPhase({ kind: 'answered', outcome, picked });
      playFeedback(cardRef.current, outcome.correct);
      // Sai → gửi ngay rating 1 (mục 5.1)
      if (!outcome.correct) submit(1, false, outcome.answer);
    },
    [submit],
  );

  const pick = useCallback(
    (key: string) => {
      if (!card || phase.kind !== 'question') return;
      const text = card.options?.find((o) => o.key === key)?.text ?? key;
      answer({ correct: key === card.answer_key, answer: text }, key);
    },
    [card, phase, answer],
  );

  // Phím tắt: Space lật, 1–4 đánh giá/chọn, Enter = Được hoặc Tiếp tục
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card || result || e.altKey || e.ctrlKey || e.metaKey) return;
      const typing =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const type = card.exercise_type;
      if (type === 'flashcard') {
        if (phase.kind === 'question' && (e.key === ' ' || e.key === 'Enter') && !typing) {
          e.preventDefault();
          setPhase({ kind: 'flipped' });
        } else if (phase.kind === 'flipped' && /^[1-4]$/.test(e.key)) {
          e.preventDefault();
          rate(Number(e.key) as Rating);
        }
        return;
      }
      if (phase.kind === 'question') {
        if ((type === 'mcq' || type === 'listening') && /^[1-4]$/.test(e.key)) {
          const opt = card.options?.[Number(e.key) - 1];
          if (opt) pick(opt.key);
        }
        return;
      }
      if (phase.kind === 'answered') {
        if (phase.outcome.correct) {
          if (/^[2-4]$/.test(e.key)) {
            e.preventDefault();
            rate(Number(e.key) as Rating);
          } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
            e.preventDefault();
            rate(3);
          }
        } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
          e.preventDefault();
          next();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, phase, result, rate, pick, next]);

  const progress = useMemo(() => (cards.length ? index / cards.length : 0), [index, cards.length]);

  // ---------------------------------------------------------------- render

  if (startError) return <ErrorState error={startError} onRetry={() => setAttempt((a) => a + 1)} />;
  if (!start) return <Skeleton lines={6} />;
  if (result)
    return <ReviewSummary result={result} mode={mode} onAgain={() => setAttempt((a) => a + 1)} />;
  if (cards.length === 0)
    return (
      <EmptyState
        title={mode === 'hard' ? 'Không có từ khó nào' : 'Hôm nay không còn từ nào cần ôn'}
        action={
          <div className={styles.emptyActions}>
            <Button onClick={() => navigate('/')}>Về trang chủ</Button>
            <Link to="/words">Xem từ của tôi</Link>
          </div>
        }
      >
        {mode === 'hard'
          ? 'Từ bạn hay quên sẽ xuất hiện ở đây để ôn riêng.'
          : 'Bạn đã ôn hết từ đến hạn. Lưu thêm từ khi đọc web để có từ mới cho ngày mai.'}
      </EmptyState>
    );
  if (!card) return <Skeleton lines={4} />;

  const title = mode === 'hard' ? 'Ôn từ khó' : mode === 'deck' ? 'Ôn theo deck' : 'Ôn tập hôm nay';

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <div className={styles.topRow}>
          <h1 className={styles.title}>{title}</h1>
          <span className={styles.count} aria-live="polite">
            Thẻ {Math.min(index + 1, cards.length)}/{cards.length}
            {xp > 0 && <span className={styles.xp}>+{xp} XP</span>}
          </span>
          <Button variant="ghost" onClick={() => void finish()} loading={finishing}>
            Kết thúc
          </Button>
        </div>
        <ProgressBar value={progress} label="Tiến độ buổi ôn" />
        {start.overload && (
          <p className={styles.notice}>Hôm nay nhiều từ cần ôn, tạm chưa thêm từ mới.</p>
        )}
      </div>

      <div className={styles.stage} key={card.card_id + index}>
        {card.exercise_type === 'flashcard' ? (
          <FlashcardView
            card={card}
            display={display}
            flipped={phase.kind === 'flipped'}
            onFlip={() => setPhase({ kind: 'flipped' })}
            cardRef={cardRef}
          />
        ) : card.exercise_type === 'mcq' || card.exercise_type === 'listening' ? (
          <ChoiceView
            card={card}
            outcome={phase.kind === 'answered' ? phase.outcome : null}
            picked={phase.kind === 'answered' ? phase.picked : null}
            onPick={pick}
            cardRef={cardRef}
          />
        ) : (
          <TypingView
            card={card}
            outcome={phase.kind === 'answered' ? phase.outcome : null}
            onSubmit={(value) =>
              answer({ correct: sameAnswer(value, card.answer_text), answer: value })
            }
            cardRef={cardRef}
          />
        )}
      </div>

      <div className={styles.controls}>
        {card.exercise_type === 'flashcard' && phase.kind === 'flipped' && (
          <RatingButtons card={card} ratings={[1, 2, 3, 4]} onRate={rate} />
        )}
        {card.exercise_type === 'flashcard' && phase.kind === 'question' && (
          <Button onClick={() => setPhase({ kind: 'flipped' })}>
            Lật thẻ <kbd className={styles.kbdInline}>Space</kbd>
          </Button>
        )}
        {phase.kind === 'answered' && phase.outcome.correct && (
          <>
            <p className={styles.feedbackOk} role="status">
              Chính xác! Bạn thấy từ này thế nào?
            </p>
            <RatingButtons card={card} ratings={[2, 3, 4]} onRate={rate} defaultRating={3} />
          </>
        )}
        {phase.kind === 'answered' && !phase.outcome.correct && (
          <>
            <p className={styles.feedbackBad} role="status">
              Chưa đúng. Từ này sẽ quay lại sớm để bạn ôn thêm.
            </p>
            <Button onClick={next} autoFocus>
              Tiếp tục <kbd className={styles.kbdInline}>Enter</kbd>
            </Button>
          </>
        )}
      </div>
      <p className={styles.shortcuts}>
        Phím tắt: <kbd>Space</kbd> lật thẻ · <kbd>1</kbd>–<kbd>4</kbd> chọn / đánh giá ·{' '}
        <kbd>Enter</kbd> Được hoặc Tiếp tục
      </p>
    </div>
  );
}
