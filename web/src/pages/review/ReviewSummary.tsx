import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FinishSessionResponse, ReviewMode } from '@/api/types';
import { useAuth } from '@/auth/authContext';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ProgressBar, Stat } from '@/components/ui';
import { effects } from '@/lib/effects';
import { formatDuration, formatPercent } from '@/lib/format';
import { readLocal, writeLocal } from '@/lib/storage';
import styles from './Review.module.css';

const STREAK_MILESTONES = [7, 30, 100, 365];

export function ReviewSummary({
  result,
  mode,
  onAgain,
}: {
  result: FinishSessionResponse;
  mode: ReviewMode;
  onAgain: () => void;
}) {
  const navigate = useNavigate();
  const { summary, today, streak, xp } = result;
  const celebrated = useRef(false);
  const { impersonating } = useAuth();

  // Khoảnh khắc 7 (xong mục tiêu ngày) và 8 (mốc streak): mỗi sự kiện chỉ một lần
  useEffect(() => {
    // Đang "xem với tư cách" người khác: không ăn mừng, không đánh dấu localStorage
    if (celebrated.current || impersonating) return;
    celebrated.current = true;
    const fx = effects();
    const doneKey = 'tv.celebrated.goal';
    if (today.goal_met && readLocal<string | null>(doneKey, null) !== today.date) {
      writeLocal(doneKey, today.date);
      fx?.complete({
        title: 'Xong mục tiêu hôm nay!',
        sub: `Bạn đã ôn ${today.reviews_count} lượt`,
      });
      return;
    }
    const milestone = STREAK_MILESTONES.filter((m) => streak.current >= m).at(-1);
    const seen = readLocal<number>('tv.celebrated.streak', 0);
    if (milestone && milestone > seen) {
      writeLocal('tv.celebrated.streak', milestone);
      fx?.streak(milestone);
    }
  }, [today, streak, impersonating]);

  if (summary.cards_reviewed === 0) {
    return (
      <div className={styles.summary}>
        <h1 className={styles.summaryTitle}>Buổi ôn đã kết thúc</h1>
        <p className={styles.summaryLead}>Bạn chưa trả lời thẻ nào. Quay lại bất cứ lúc nào nhé.</p>
        <div className={styles.summaryActions}>
          <Button onClick={() => navigate('/')}>Về trang chủ</Button>
          <Button variant="secondary" onClick={onAgain}>
            Bắt đầu lại
          </Button>
        </div>
      </div>
    );
  }

  const accuracy = summary.cards_reviewed ? summary.correct_count / summary.cards_reviewed : 0;
  const lead =
    summary.newly_mastered > 0
      ? `Bạn vừa thuộc vững thêm ${summary.newly_mastered} từ.`
      : accuracy >= 0.8
        ? 'Trí nhớ của bạn đang rất tốt.'
        : 'Những từ hay quên sẽ quay lại sớm hơn để bạn nhớ chắc.';

  return (
    <div className={styles.summary}>
      <div className={styles.summaryIcon} aria-hidden="true">
        <Icon name="check" size={40} />
      </div>
      <h1 className={styles.summaryTitle}>
        {today.goal_met ? 'Xong mục tiêu hôm nay!' : 'Hoàn thành buổi ôn'}
      </h1>
      <p className={styles.summaryLead}>{lead}</p>

      <div className={styles.summaryStats}>
        <Stat
          label="Thẻ đã ôn"
          value={summary.cards_reviewed}
          hint={`${summary.new_cards} từ mới`}
        />
        <Stat
          label="Nhớ đúng"
          value={formatPercent(accuracy)}
          hint={`${summary.correct_count} thẻ`}
        />
        <Stat label="XP nhận được" value={`+${summary.xp_earned}`} hint={`Cấp ${xp.level}`} />
        <Stat label="Thời gian" value={formatDuration(summary.duration_seconds)} />
      </div>

      <div className={styles.summaryRow}>
        <div className={styles.streakBox}>
          <Icon name="streak" size={28} />
          <div>
            <strong>{streak.current} ngày liên tiếp</strong>
            <span>
              {streak.freezes_available > 0
                ? `Có ${streak.freezes_available} thẻ đóng băng giữ chuỗi khi bạn bận`
                : 'Học đều 7 ngày để nhận thẻ đóng băng'}
            </span>
          </div>
        </div>
        <div className={styles.levelBox}>
          <span>
            Cấp {xp.level} · còn {xp.xp_to_next_level} XP lên cấp {xp.level + 1}
          </span>
          <ProgressBar value={xp.level_progress} label="Tiến độ lên cấp" />
        </div>
      </div>

      {!today.goal_met && today.due_remaining > 0 && (
        <p className={styles.summaryNote}>Còn {today.due_remaining} từ đến hạn hôm nay.</p>
      )}

      <div className={styles.summaryActions}>
        <Button onClick={() => navigate('/')}>Về trang chủ</Button>
        {(today.due_remaining > 0 || mode !== 'daily') && (
          <Button variant="secondary" onClick={onAgain}>
            Ôn tiếp
          </Button>
        )}
        <Link to="/stats" className={styles.summaryLink}>
          Xem thống kê
        </Link>
      </div>
    </div>
  );
}
