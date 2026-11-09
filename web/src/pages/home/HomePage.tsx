import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@/api/endpoints';
import { useAuth } from '@/auth/authContext';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ErrorState, ProgressBar, Skeleton, Stat } from '@/components/ui';
import { effects } from '@/lib/effects';
import { formatNumber } from '@/lib/format';
import { qk } from '@/lib/queryKeys';
import { readLocal, writeLocal } from '@/lib/storage';
import styles from './Home.module.css';

const STREAK_MILESTONES = [7, 30, 100, 365];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export function HomePage() {
  const { user, impersonating } = useAuth();
  const navigate = useNavigate();
  const summary = useQuery({ queryKey: qk.summary, queryFn: statsApi.summary });

  // Khoảnh khắc 8: mốc streak, hiện ở lần mở app đầu tiên sau khi đạt (mỗi mốc một lần)
  useEffect(() => {
    // Đang "xem với tư cách" người khác: không ăn mừng, không đánh dấu đã xem mốc (của người đó)
    if (impersonating) return;
    const cur = summary.data?.streak.current ?? 0;
    const milestone = STREAK_MILESTONES.filter((m) => cur >= m).at(-1);
    const seen = readLocal<number>('tv.celebrated.streak', 0);
    if (milestone && milestone > seen) {
      writeLocal('tv.celebrated.streak', milestone);
      effects()?.streak(milestone);
    }
  }, [summary.data, impersonating]);

  if (summary.isPending) return <Skeleton lines={8} />;
  if (summary.isError)
    return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />;
  const s = summary.data;
  const t = s.today;

  // Thanh tiến độ ngày bắt đầu ở mức "tặng sẵn" (hiệu ứng tiến độ được ban tặng), không từ 0
  const newLeft = Math.max(
    0,
    Math.min(s.new_available_today, t.goal_new_words - t.new_words_learned),
  );
  const done = t.reviews_count;
  const total = done + t.due_remaining + newLeft;
  const gift = Math.max(1, Math.round(total * 0.12));
  const progress = total === 0 ? 1 : (done + gift) / (total + gift);
  const toStudy = s.due_today + s.new_available_today;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.hello}>
            {greeting()}
            {user?.name ? `, ${user.name}` : ''}!
          </p>
          {t.goal_met ? (
            <h1 className={styles.heroTitle}>Bạn đã xong mục tiêu hôm nay</h1>
          ) : toStudy > 0 ? (
            <h1 className={styles.heroTitle}>
              Hôm nay có <span className={styles.num}>{s.due_today}</span> từ cần ôn
              {s.new_available_today > 0 && (
                <>
                  {' '}
                  và <span className={styles.num}>{s.new_available_today}</span> từ mới
                </>
              )}
            </h1>
          ) : (
            <h1 className={styles.heroTitle}>Hôm nay không còn từ nào cần ôn</h1>
          )}
          <div className={styles.dayProgress}>
            <ProgressBar value={progress} label="Tiến độ hôm nay" />
            <span className={styles.dayText}>
              {done > 0 ? `Đã ôn ${done} lượt` : 'Bắt đầu thôi, bạn đã đi được một đoạn rồi'}
              {t.due_remaining > 0 && ` · còn ${t.due_remaining} từ đến hạn`}
            </span>
          </div>
          <div className={styles.heroActions}>
            <Button
              onClick={() => navigate('/review')}
              disabled={toStudy === 0 && !t.due_remaining}
            >
              <Icon name="review" size={18} /> Ôn ngay
            </Button>
            {s.hard_count > 0 && (
              <Button variant="secondary" onClick={() => navigate('/review?mode=hard')}>
                Ôn {s.hard_count} từ khó
              </Button>
            )}
          </div>
        </div>
        <div className={styles.side}>
          <div className={styles.streak}>
            <Icon name="streak" size={36} />
            <div>
              <strong className={styles.streakNum}>{s.streak.current}</strong>
              <span> ngày liên tiếp</span>
              <p className={styles.small}>
                {s.streak.today_done
                  ? 'Hôm nay đã học, chuỗi được giữ.'
                  : s.streak.current > 0
                    ? 'Ôn một thẻ là giữ được chuỗi hôm nay.'
                    : 'Ôn một thẻ để bắt đầu chuỗi mới.'}
              </p>
              <p className={`${styles.small} ${styles.facts}`}>
                <span>Thẻ đóng băng: {s.streak.freezes_available}</span>
                <span>Dài nhất: {s.streak.longest} ngày</span>
              </p>
            </div>
          </div>
          <div className={styles.level}>
            <div className={styles.levelRow}>
              <Icon name="xp" size={22} />
              <strong>Cấp {s.xp.level}</strong>
              <span className={styles.small}>{formatNumber(s.xp.total)} XP</span>
            </div>
            <ProgressBar value={s.xp.level_progress} label="Tiến độ lên cấp" />
            <span className={styles.small}>
              Còn {s.xp.xp_to_next_level} XP lên cấp {s.xp.level + 1}
            </span>
          </div>
        </div>
      </section>

      <section className={styles.stats} aria-label="Tổng quan">
        <Stat
          label="Đã lưu"
          value={formatNumber(s.saved_count)}
          hint={`${s.learning_count} đang học`}
        />
        <Stat
          label="Đã thuộc vững"
          value={formatNumber(s.mastered_count)}
          hint="Nhớ chắc từ 21 ngày"
        />
        <Stat label="Đã biết" value={formatNumber(s.known_count)} hint="Không cần ôn" />
        <Stat
          label="Từ khó"
          value={s.hard_count}
          hint={s.hard_count ? <Link to="/words?hard=1">Xem danh sách</Link> : 'Không có'}
        />
      </section>

      {s.saved_count === 0 && (
        <section className={styles.tip}>
          <h2>Bắt đầu lưu từ đầu tiên</h2>
          <ol>
            <li>Cài extension Transaver Word cho Chrome và đăng nhập trong popup.</li>
            <li>Bôi đen một từ khi đọc web, bấm icon Transaver rồi bấm Lưu.</li>
            <li>Từ sẽ có ở đây kèm câu bạn đã gặp, sẵn sàng để ôn.</li>
          </ol>
        </section>
      )}
    </div>
  );
}
