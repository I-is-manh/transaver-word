import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { statsApi } from '@/api/endpoints';
import type { Achievement, WeeklyReport } from '@/api/types';
import { Button } from '@/components/Button';
import { BarChart, Heatmap, LineChart } from '@/components/charts';
import { Icon } from '@/components/Icon';
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton, Stat } from '@/components/ui';
import { formatDate, formatDay, formatNumber, formatPercent } from '@/lib/format';
import { qk } from '@/lib/queryKeys';
import styles from './Stats.module.css';
import { ArrowIcon } from '@/components/ArrowIcon';

function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  return new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
}

export function StatsPage() {
  const summary = useQuery({ queryKey: qk.summary, queryFn: statsApi.summary });
  const [range, setRange] = useState<30 | 90>(30);
  const today = summary.data?.today.date;
  const heatmap = useQuery({
    queryKey: [...qk.stats, 'heatmap', today],
    queryFn: () => statsApi.heatmap(addDays(today!, -364), today),
    enabled: !!today,
  });
  const progress = useQuery({
    queryKey: [...qk.stats, 'progress', range],
    queryFn: () => statsApi.progress(range).then((r) => r.points),
  });

  if (summary.isPending) return <Skeleton lines={10} />;
  if (summary.isError)
    return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />;
  const s = summary.data;

  return (
    <div className={styles.stack}>
      <PageHeader title="Thống kê" subtitle="Tiến bộ của bạn, đo bằng số từ bạn thật sự nhớ." />
      <section className={styles.tiles}>
        <Stat
          label="Đã lưu"
          value={formatNumber(s.saved_count)}
          hint={`${s.learning_count} đang học · ${s.known_count} đã biết`}
        />
        <Stat
          label="Đã thuộc vững"
          value={formatNumber(s.mastered_count)}
          hint="Nhớ chắc từ 21 ngày trở lên"
        />
        <Stat
          label="Cần ôn hôm nay"
          value={s.due_today}
          hint={`${s.new_available_today} từ mới sẵn sàng`}
        />
        <Stat
          label="Streak"
          value={`${s.streak.current} ngày`}
          hint={`Dài nhất ${s.streak.longest} ngày`}
        />
        <Stat label="Cấp độ" value={s.xp.level} hint={`${formatNumber(s.xp.total)} XP`} />
      </section>

      <Panel title="Lịch học">
        {heatmap.isPending ? (
          <Skeleton lines={4} />
        ) : heatmap.isError ? (
          <ErrorState error={heatmap.error} onRetry={() => void heatmap.refetch()} />
        ) : (
          <Heatmap days={heatmap.data.days} to={today!} />
        )}
      </Panel>

      <Panel
        title="Biểu đồ tiến bộ"
        actions={
          <div className={styles.segmented} role="group" aria-label="Khoảng thời gian">
            {([30, 90] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={range === d}
                className={range === d ? styles.segOn : styles.seg}
                onClick={() => setRange(d)}
              >
                {d} ngày
              </button>
            ))}
          </div>
        }
      >
        {progress.isPending ? (
          <Skeleton lines={5} />
        ) : progress.isError ? (
          <ErrorState error={progress.error} onRetry={() => void progress.refetch()} />
        ) : (
          <div className={styles.charts}>
            <LineChart
              title="Tổng số từ đã thuộc vững"
              unit="từ đã thuộc"
              points={progress.data.map((p) => ({ label: p.date, value: p.mastered_total }))}
            />
            <LineChart
              title="Tổng số từ đã lưu"
              unit="từ đã lưu"
              points={progress.data.map((p) => ({ label: p.date, value: p.saved_total }))}
            />
            <BarChart
              title="Số lượt ôn mỗi ngày"
              unit="lượt ôn"
              points={progress.data.map((p) => ({ label: p.date, value: p.reviews_count }))}
            />
          </div>
        )}
      </Panel>

      <div className={styles.twoCol}>
        <WeeklyReportPanel />
        <AchievementsPanel />
      </div>
    </div>
  );
}

function Delta({
  cur,
  prev,
  percent = false,
}: {
  cur: number | null;
  prev: number | null;
  percent?: boolean;
}) {
  // accuracy có thể null khi tuần không có lượt ôn (v0.8)
  if (cur === null || prev === null) return null;
  const d = cur - prev;
  if (Math.abs(d) < (percent ? 0.005 : 1))
    return <span className={styles.flat}>như tuần trước</span>;
  const text = percent ? `${Math.round(Math.abs(d) * 100)} điểm %` : formatNumber(Math.abs(d));
  // Ghi nhận năng lực, không đe dọa: giảm thì nói trung tính
  return d > 0 ? (
    <span className={styles.up}>tăng {text} so với tuần trước</span>
  ) : (
    <span className={styles.flat}>
      tuần trước {percent ? formatPercent(prev) : formatNumber(prev)}
    </span>
  );
}

function WeeklyReportPanel() {
  const [week, setWeek] = useState<string | undefined>(undefined);
  const report = useQuery({
    queryKey: [...qk.stats, 'weekly', week ?? 'last'],
    queryFn: () => statsApi.weekly(week),
  });
  const r: WeeklyReport | undefined = report.data;
  const thisMonday = (() => {
    const t = new Date();
    const dow = (t.getDay() + 6) % 7;
    t.setDate(t.getDate() - dow);
    return t.toISOString().slice(0, 10);
  })();
  return (
    <Panel
      title="Báo cáo tuần"
      actions={
        r && (
          <div className={styles.weekNav}>
            <Button
              variant="ghost"
              aria-label="Tuần trước"
              onClick={() => setWeek(addDays(r.week_start, -7))}
            >
              <ArrowIcon dir="left" />
            </Button>
            <span>
              {formatDay(r.week_start)} – {formatDay(r.week_end)}
            </span>
            <Button
              variant="ghost"
              aria-label="Tuần sau"
              disabled={addDays(r.week_start, 7) >= thisMonday}
              onClick={() => setWeek(addDays(r.week_start, 7))}
            >
              <ArrowIcon dir="right" />
            </Button>
          </div>
        )
      }
    >
      {report.isPending ? (
        <Skeleton lines={4} />
      ) : report.isError ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : r ? (
        <div className={styles.report}>
          <p className={styles.reportLead}>
            {r.newly_mastered > 0
              ? `Tuần này bạn thuộc vững thêm ${r.newly_mastered} từ. Tổng cộng ${r.mastered_total} từ đã thuộc.`
              : r.days_active > 0
                ? `Tuần này bạn học ${r.days_active} ngày. Từ bạn ôn đều sẽ sớm vào nhóm đã thuộc.`
                : 'Tuần này chưa có buổi ôn nào. Chỉ cần vài phút mỗi ngày là đủ.'}
          </p>
          <dl className={styles.reportList}>
            <dt>Ngày học</dt>
            <dd>
              {r.days_active}/7 <Delta cur={r.days_active} prev={r.previous.days_active} />
            </dd>
            <dt>Lượt ôn</dt>
            <dd>
              {formatNumber(r.reviews_count)}{' '}
              <Delta cur={r.reviews_count} prev={r.previous.reviews_count} />
            </dd>
            <dt>Nhớ đúng</dt>
            <dd>
              {r.accuracy === null ? '—' : formatPercent(r.accuracy)}{' '}
              <Delta cur={r.accuracy} prev={r.previous.accuracy} percent />
            </dd>
            <dt>Từ mới lưu</dt>
            <dd>
              {r.words_saved} <Delta cur={r.words_saved} prev={r.previous.words_saved} />
            </dd>
            <dt>XP</dt>
            <dd>+{formatNumber(r.xp_earned)}</dd>
          </dl>
        </div>
      ) : null}
    </Panel>
  );
}

function AchievementsPanel() {
  const list = useQuery({
    queryKey: qk.achievements,
    queryFn: () => statsApi.achievements().then((r) => r.data),
    retry: false,
  });
  return (
    <Panel title="Huy hiệu">
      {list.isPending ? (
        <Skeleton lines={4} />
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.status === 404 ? (
          <EmptyState title="Huy hiệu sắp ra mắt" />
        ) : (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        )
      ) : (
        <>
          <ul className={styles.badges}>
            {list.data.map((a) => (
              <Badge key={a.code} a={a} />
            ))}
          </ul>
          <p className={styles.hidden}>Còn vài huy hiệu bất ngờ đang chờ bạn khám phá.</p>
        </>
      )}
    </Panel>
  );
}

function Badge({ a }: { a: Achievement }) {
  const earned = !!a.earned_at;
  return (
    <li className={earned ? styles.badgeOn : styles.badge}>
      <span className={styles.badgeIcon}>
        <Icon name={a.icon} size={26} />
      </span>
      <span className={styles.badgeText}>
        <strong>{a.name}</strong>
        <small>{a.description}</small>
        <small>
          {earned ? `Đạt ngày ${formatDate(a.earned_at)}` : `+${a.xp_reward} XP khi đạt`}
        </small>
      </span>
    </li>
  );
}
