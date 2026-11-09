import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/api/endpoints';
import type { OnboardingRequest } from '@/api/types';
import { ME_QUERY_KEY } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { CornerAppearanceSwitcher } from '@/components/AppearanceSwitcher';
import { Logo } from '@/components/Logo';
import { qk } from '@/lib/queryKeys';
import styles from './Onboarding.module.css';
import { ArrowIcon } from '@/components/ArrowIcon';

const QUESTIONS = [
  {
    key: 'goal',
    title: 'Bạn học từ vựng để làm gì?',
    options: [
      { value: 'exam', label: 'Thi chứng chỉ', hint: 'IELTS, TOEIC… Ôn dày hơn để nhớ chắc' },
      { value: 'work', label: 'Công việc', hint: 'Đọc tài liệu, email, họp' },
      { value: 'travel', label: 'Du lịch', hint: 'Giao tiếp khi đi xa' },
      { value: 'hobby', label: 'Sở thích', hint: 'Đọc báo, xem phim, lướt web' },
    ],
  },
  {
    key: 'level',
    title: 'Trình độ hiện tại của bạn?',
    options: [
      {
        value: 'beginner',
        label: 'Mới bắt đầu',
        hint: 'Bài tập nhẹ nhàng: thẻ ghi nhớ và trắc nghiệm',
      },
      { value: 'intermediate', label: 'Trung cấp', hint: 'Thêm bài điền từ vào câu bạn đã gặp' },
      { value: 'advanced', label: 'Nâng cao', hint: 'Đủ các dạng bài' },
    ],
  },
  {
    key: 'daily_minutes',
    title: 'Mỗi ngày bạn có bao nhiêu thời gian?',
    options: [
      { value: 5, label: '5 phút', hint: 'Khoảng 3 từ mới mỗi ngày' },
      { value: 10, label: '10 phút', hint: 'Khoảng 7 từ mới mỗi ngày' },
      { value: 20, label: '20 phút', hint: 'Khoảng 15 từ mới mỗi ngày' },
    ],
  },
] as const;

type Answers = Partial<OnboardingRequest>;
const DEFAULTS: OnboardingRequest = { goal: 'hobby', level: 'intermediate', daily_minutes: 10 };

export function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = QUESTIONS[step]!;
  const value = answers[q.key];

  async function submit(body: OnboardingRequest) {
    setSaving(true);
    setError(null);
    try {
      const res = await settingsApi.onboarding(body);
      qc.setQueriesData({ queryKey: ME_QUERY_KEY }, res.user);
      qc.setQueryData(qk.settings, res.settings);
      navigate('/', { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  function choose(v: string | number) {
    const next = { ...answers, [q.key]: v } as Answers;
    setAnswers(next);
  }

  function goNext() {
    if (step < QUESTIONS.length - 1) setStep(step + 1);
    else void submit({ ...DEFAULTS, ...answers } as OnboardingRequest);
  }

  return (
    <div className={`${styles.page} tv-page`}>
      <CornerAppearanceSwitcher />
      <div className={styles.card}>
        <Logo />
        <p className={styles.step}>
          Câu {step + 1}/{QUESTIONS.length}
        </p>
        <div className={styles.dots} aria-hidden="true">
          {QUESTIONS.map((_, i) => (
            <span key={i} className={i <= step ? styles.dotOn : styles.dot} />
          ))}
        </div>
        <fieldset className={styles.fieldset}>
          <legend className={styles.title}>{q.title}</legend>
          <div className={styles.options}>
            {q.options.map((o) => (
              <label
                key={String(o.value)}
                className={value === o.value ? styles.optionOn : styles.option}
              >
                <input
                  type="radio"
                  name={q.key}
                  value={String(o.value)}
                  checked={value === o.value}
                  onChange={() => choose(o.value)}
                  onKeyDown={(e) => e.key === 'Enter' && value !== undefined && goNext()}
                />
                <span className={styles.optionLabel}>{o.label}</span>
                <span className={styles.optionHint}>{o.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              <ArrowIcon dir="left" />
              Quay lại
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => void submit(DEFAULTS)} disabled={saving}>
              Bỏ qua, dùng mặc định
            </Button>
          )}
          <Button onClick={goNext} disabled={value === undefined} loading={saving}>
            {step < QUESTIONS.length - 1 ? 'Tiếp' : 'Bắt đầu học'}
          </Button>
        </div>
        <p className={styles.note}>Bạn có thể đổi lại bất cứ lúc nào trong Cài đặt.</p>
      </div>
    </div>
  );
}
