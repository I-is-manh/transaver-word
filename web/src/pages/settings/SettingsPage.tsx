import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { settingsApi } from '@/api/endpoints';
import type { ExerciseType, ReminderChannel, Settings } from '@/api/types';
import { useAuth } from '@/auth/authContext';
import { clearToken } from '@/auth/tokenStorage';
import { AppearanceSwitcher } from '@/components/AppearanceSwitcher';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/toastContext';
import { ErrorState, PageHeader, Panel, Skeleton } from '@/components/ui';
import { qk } from '@/lib/queryKeys';
import styles from './Settings.module.css';

const EXERCISES: { value: ExerciseType; label: string; hint: string }[] = [
  { value: 'flashcard', label: 'Thẻ ghi nhớ', hint: 'Luôn bật, dùng cho từ mới' },
  { value: 'mcq', label: 'Trắc nghiệm', hint: 'Chọn nghĩa đúng trong 4 đáp án' },
  { value: 'cloze', label: 'Điền vào câu gốc', hint: 'Gõ từ còn thiếu trong câu bạn đã gặp' },
  { value: 'listening', label: 'Nghe', hint: 'Nghe phát âm, chọn nghĩa' },
  { value: 'dictation', label: 'Chính tả', hint: 'Nghe phát âm, gõ lại từ' },
];

const RETENTION = [
  { value: 0.85, label: 'Nhẹ nhàng', hint: 'Ít lượt ôn, chấp nhận quên một ít' },
  { value: 0.9, label: 'Cân bằng', hint: 'Khuyên dùng' },
  { value: 0.95, label: 'Nhớ thật chắc', hint: 'Ôn dày hơn, hợp khi sắp thi' },
];

function timezones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf(
      'timeZone',
    );
  } catch {
    return ['Asia/Ho_Chi_Minh'];
  }
}

/** Chỉ gửi các trường đã đổi (PATCH một phần). */
function diff(a: Settings, b: Settings): Partial<Settings> {
  const out: Partial<Settings> = {};
  for (const k of Object.keys(b) as (keyof Settings)[]) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) (out as Record<string, unknown>)[k] = b[k];
  }
  return out;
}

export function SettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const settings = useQuery({
    queryKey: qk.settings,
    queryFn: () => settingsApi.get().then((r) => r.settings),
  });
  const [form, setForm] = useState<Settings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const zones = useMemo(timezones, []);

  useEffect(() => {
    // Giao diện được lưu ngay (không qua nút Lưu): chỉ đồng bộ trường đó, giữ thay đổi chưa lưu khác
    if (settings.data)
      setForm((prev) => (prev ? { ...prev, appearance: settings.data.appearance } : settings.data));
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (patch: Partial<Settings>) => settingsApi.update(patch),
    onSuccess: ({ settings: s }) => {
      qc.setQueryData(qk.settings, s);
      void qc.invalidateQueries({ queryKey: qk.stats });
      setErrors({});
      toast.show({ tone: 'success', message: 'Đã lưu cài đặt.' });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422) {
        setErrors(
          Object.fromEntries(
            Object.entries(e.errors).map(([k, v]) => [k.split('.')[0]!, v[0] ?? '']),
          ),
        );
      }
      toast.show({ tone: 'error', message: (e as Error).message });
    },
  });

  if (settings.isPending || !form) return <Skeleton lines={10} />;
  if (settings.isError)
    return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;

  const changes = diff(settings.data, form);
  const dirty = Object.keys(changes).length > 0;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));
  const toggleIn = <T,>(list: T[], v: T, on: boolean) =>
    on ? [...new Set([...list, v])] : list.filter((x) => x !== v);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (dirty) save.mutate(changes);
  };

  return (
    <>
      <PageHeader title="Cài đặt" subtitle="Thay đổi được áp dụng cho cả web và extension." />
      <form className={styles.layout} onSubmit={submit}>
        <Panel title="Mục tiêu mỗi ngày">
          <Row label="Số từ mới mỗi ngày" error={errors.daily_new_words} htmlFor="dnw">
            <input
              id="dnw"
              type="number"
              min={1}
              max={50}
              className={styles.number}
              value={form.daily_new_words}
              onChange={(e) => set('daily_new_words', Number(e.target.value))}
            />
          </Row>
          <Row
            label="Giới hạn lượt ôn mỗi ngày"
            hint="Khi số từ đến hạn vượt giới hạn này, app tạm ngưng thêm từ mới để bạn không bị dồn."
            error={errors.daily_review_limit}
            htmlFor="drl"
          >
            <input
              id="drl"
              type="number"
              min={20}
              max={500}
              step={10}
              className={styles.number}
              value={form.daily_review_limit}
              onChange={(e) => set('daily_review_limit', Number(e.target.value))}
            />
          </Row>
        </Panel>

        <Panel title="Nhắc học">
          <Row label="Giờ nhắc" error={errors.reminder_time} htmlFor="rt">
            <div className={styles.inline}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={form.reminder_time !== null}
                  onChange={(e) => set('reminder_time', e.target.checked ? '21:00' : null)}
                />
                Bật nhắc
              </label>
              {form.reminder_time !== null && (
                <input
                  id="rt"
                  type="time"
                  className={styles.time}
                  value={form.reminder_time}
                  onChange={(e) => set('reminder_time', e.target.value || null)}
                />
              )}
            </div>
          </Row>
          <Row label="Kênh nhắc" error={errors.reminder_channels}>
            <div className={styles.inline}>
              {(
                [
                  ['browser', 'Thông báo trình duyệt (qua extension)'],
                  ['email', 'Email'],
                ] as [ReminderChannel, string][]
              ).map(([v, label]) => (
                <label key={v} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={form.reminder_channels.includes(v)}
                    disabled={form.reminder_time === null}
                    onChange={(e) =>
                      set(
                        'reminder_channels',
                        toggleIn(form.reminder_channels, v, e.target.checked),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </Row>
          <Row
            label="Múi giờ"
            error={errors.timezone}
            htmlFor="tz"
            hint="Dùng để tính ngày học và giờ nhắc."
          >
            <select
              id="tz"
              className={styles.select}
              value={form.timezone}
              onChange={(e) => set('timezone', e.target.value)}
            >
              {(zones.includes(form.timezone) ? zones : [form.timezone, ...zones]).map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </Row>
        </Panel>

        <Panel title="Dạng bài">
          <p className={styles.panelHint}>
            App tự chọn dạng bài theo độ quen của từng từ, trong các dạng bạn bật.
          </p>
          <div className={styles.grid2}>
            {EXERCISES.map((x) => (
              <label key={x.value} className={styles.choice}>
                <input
                  type="checkbox"
                  checked={x.value === 'flashcard' || form.exercise_types.includes(x.value)}
                  disabled={x.value === 'flashcard'}
                  onChange={(e) =>
                    set('exercise_types', toggleIn(form.exercise_types, x.value, e.target.checked))
                  }
                />
                <span>
                  <strong>{x.label}</strong>
                  <small>{x.hint}</small>
                </span>
              </label>
            ))}
          </div>
          {errors.exercise_types && <p className={styles.error}>{errors.exercise_types}</p>}
        </Panel>

        <Panel title="Mức ghi nhớ">
          <p className={styles.panelHint}>
            Muốn nhớ chắc hơn thì app cho ôn dày hơn. Hiện tại: nhớ được khoảng{' '}
            <strong>{Math.round(form.desired_retention * 100)}%</strong> số từ khi đến hạn ôn.
          </p>
          <div className={styles.grid3} role="radiogroup" aria-label="Mức ghi nhớ">
            {RETENTION.map((r) => (
              <label key={r.value} className={styles.choice}>
                <input
                  type="radio"
                  name="retention"
                  checked={Math.abs(form.desired_retention - r.value) < 0.001}
                  onChange={() => set('desired_retention', r.value)}
                />
                <span>
                  <strong>
                    {r.label} ({Math.round(r.value * 100)}%)
                  </strong>
                  <small>{r.hint}</small>
                </span>
              </label>
            ))}
          </div>
          <label className={styles.range}>
            <span>Tùy chỉnh: {Math.round(form.desired_retention * 100)}%</span>
            <input
              type="range"
              min={0.8}
              max={0.97}
              step={0.01}
              value={form.desired_retention}
              onChange={(e) => set('desired_retention', Number(e.target.value))}
            />
          </label>
          {errors.desired_retention && <p className={styles.error}>{errors.desired_retention}</p>}
        </Panel>

        <Panel title="Thông tin trên thẻ">
          <div className={styles.inline}>
            {(
              [
                ['phonetic', 'Phiên âm'],
                ['english_definition', 'Nghĩa tiếng Anh'],
                ['context_sentence', 'Câu ngữ cảnh'],
              ] as [keyof Settings['card_display'], string][]
            ).map(([k, label]) => (
              <label key={k} className={styles.check}>
                <input
                  type="checkbox"
                  checked={form.card_display[k]}
                  onChange={(e) =>
                    set('card_display', { ...form.card_display, [k]: e.target.checked })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </Panel>

        <Panel title="Giao diện">
          <p className={styles.panelHint}>
            Chọn sáng, tối hoặc theo hệ điều hành. Áp dụng ngay, đồng bộ với extension và các máy
            khác.
          </p>
          <AppearanceSwitcher showLabels />
        </Panel>

        <Panel title="Báo cáo và quyền riêng tư">
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={form.weekly_report}
              onChange={(e) => set('weekly_report', e.target.checked)}
            />
            Gửi báo cáo tuần qua email (sáng thứ Hai)
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={form.save_page_url}
              onChange={(e) => set('save_page_url', e.target.checked)}
            />
            Lưu link và tiêu đề trang web khi lưu từ
          </label>
          <p className={styles.panelHint}>
            Đọc <Link to="/privacy">Chính sách quyền riêng tư</Link> để biết app lưu những gì.
          </p>
        </Panel>

        <div className={styles.saveBar}>
          <span>{dirty ? 'Có thay đổi chưa lưu' : 'Mọi thay đổi đã được lưu'}</span>
          <Button variant="ghost" disabled={!dirty} onClick={() => setForm(settings.data)}>
            Hoàn tác
          </Button>
          <Button type="submit" disabled={!dirty} loading={save.isPending}>
            Lưu thay đổi
          </Button>
        </div>
      </form>

      <DeleteAccount />
    </>
  );
}

function Row({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>
        <label htmlFor={htmlFor}>{label}</label>
        {hint && <small>{hint}</small>}
      </div>
      <div className={styles.rowControl}>
        {children}
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}

function DeleteAccount() {
  const { user, impersonating } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | undefined>();
  const hasPassword = user?.has_password !== false;
  const del = useMutation({
    mutationFn: () =>
      settingsApi.deleteAccount(hasPassword ? { password } : { confirm_email: password }),
    onSuccess: () => {
      clearToken();
      qc.clear();
      navigate('/login', { replace: true, state: { deleted: true } });
      window.location.reload();
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? (e.field('password') ?? e.field('confirm_email') ?? e.message)
          : 'Có lỗi xảy ra.',
      ),
  });
  return (
    <Panel title="Xóa tài khoản" className={styles.danger}>
      <p className={styles.panelHint}>
        Xóa vĩnh viễn tài khoản <strong>{user?.email}</strong> cùng toàn bộ từ, câu ngữ cảnh, lịch
        sử ôn và cài đặt. Không thể khôi phục. Extension cũng sẽ tự đăng xuất.
      </p>
      {impersonating ? (
        <p className={styles.panelHint}>
          Không thể xóa tài khoản khi đang xem với tư cách người khác. Dùng nút “Quay lại tài khoản
          của tôi”.
        </p>
      ) : !open ? (
        <Button variant="secondary" className={styles.dangerBtn} onClick={() => setOpen(true)}>
          Tôi muốn xóa tài khoản
        </Button>
      ) : (
        <form
          className={styles.deleteForm}
          onSubmit={(e) => {
            e.preventDefault();
            setError(undefined);
            del.mutate();
          }}
        >
          <TextField
            label={hasPassword ? 'Nhập mật khẩu để xác nhận' : 'Nhập email tài khoản để xác nhận'}
            type={hasPassword ? 'password' : 'email'}
            autoComplete={hasPassword ? 'current-password' : 'off'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
            autoFocus
          />
          <TextField
            label='Gõ "XÓA" để xác nhận'
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <div className={styles.inline}>
            <Button
              type="submit"
              className={styles.dangerSolid}
              disabled={!password || confirm.trim().toUpperCase() !== 'XÓA'}
              loading={del.isPending}
            >
              Xóa vĩnh viễn
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Hủy
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}
