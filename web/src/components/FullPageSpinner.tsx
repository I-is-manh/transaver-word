import styles from './FullPageSpinner.module.css';

export function FullPageSpinner({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
