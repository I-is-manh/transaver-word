import { useId } from 'react';
import type { Appearance } from '@/api/types';
import { useAppearance } from './appearanceContext';
import styles from './AppearanceSwitcher.module.css';

const OPTIONS: { value: Appearance; label: string; icon: JSX.Element }[] = [
  {
    value: 'system',
    label: 'Theo hệ thống',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="4.5" width="17" height="12" rx="2" />
        <path d="M9 20h6M12 16.5V20" />
      </svg>
    ),
  },
  {
    value: 'light',
    label: 'Sáng',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Tối',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
    ),
  },
];

/** Nút chọn giao diện đặt cố định ở góc trên bên phải (trang không có header). */
export function CornerAppearanceSwitcher() {
  return (
    <div className={styles.corner}>
      <AppearanceSwitcher />
    </div>
  );
}

/** Chọn giao diện: 3 nút radio (phím mũi tên để đổi), có nhãn cho trình đọc màn hình. */
export function AppearanceSwitcher({ showLabels = false }: { showLabels?: boolean }) {
  const { appearance, setAppearance } = useAppearance();
  const name = useId();
  return (
    <div className={styles.group} role="radiogroup" aria-label="Giao diện sáng/tối">
      {OPTIONS.map((o) => (
        <label key={o.value} className={styles.option} title={o.label}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={appearance === o.value}
            onChange={() => setAppearance(o.value)}
            className={styles.input}
            aria-label={o.label}
          />
          <span className={styles.face}>
            {o.icon}
            {showLabels && <span>{o.label}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}
