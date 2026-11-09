import { useEffect, useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Button } from './Button';
import styles from './ui.module.css';
import { ArrowIcon } from './ArrowIcon';

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      {back && <div className={styles.back}>{back}</div>}
      <div className={styles.pageHeaderRow}>
        <div>
          <h1 className={styles.pageTitle}>{title}</h1>
          {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={styles.pageActions}>{actions}</div>}
      </div>
    </header>
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={[styles.panel, className ?? ''].filter(Boolean).join(' ')}>
      {(title || actions) && (
        <div className={styles.panelHead}>
          {title && <h2 className={styles.panelTitle}>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'accent' | 'danger' | 'info';
}) {
  return <span className={`${styles.chip} ${styles[`chip_${tone}`]}`}>{children}</span>;
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      {children && <p className={styles.emptyText}>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className={styles.errorBox} role="alert">
      <span>{error instanceof Error ? error.message : 'Có lỗi xảy ra.'}</span>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Thử lại
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className={styles.skeleton} aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={styles.skeletonLine} />
      ))}
    </div>
  );
}

export function Pagination({
  page,
  lastPage,
  total,
  onPage,
}: {
  page: number;
  lastPage: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (lastPage <= 1) return null;
  return (
    <nav className={styles.pagination} aria-label="Phân trang">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ArrowIcon dir="left" />
        Trước
      </Button>
      <span className={styles.pageInfo}>
        Trang {page}/{lastPage} · {total} mục
      </span>
      <Button variant="secondary" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>
        Sau
        <ArrowIcon dir="right" />
      </Button>
    </nav>
  );
}

export function Select({
  label,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className={[styles.selectField, className ?? ''].filter(Boolean).join(' ')}>
      <span className={styles.selectLabel}>{label}</span>
      <select className={styles.select} {...rest}>
        {children}
      </select>
    </label>
  );
}

/** Nút xóa hai bước: bấm lần đầu hiện "Chắc chắn?" + Hủy. */
export function ConfirmButton({
  children,
  confirmLabel = 'Xác nhận xóa',
  onConfirm,
  disabled,
  loading,
  trigger,
}: {
  children?: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Nút bước đầu tự vẽ (vd. IconButton); mặc định là nút chữ màu đỏ. */
  trigger?: (ask: () => void) => ReactNode;
}) {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const t = window.setTimeout(() => setAsking(false), 5000);
    return () => window.clearTimeout(t);
  }, [asking]);
  if (!asking && trigger) return <>{trigger(() => setAsking(true))}</>;
  if (!asking)
    return (
      <Button
        variant="ghost"
        className={styles.dangerText}
        disabled={disabled}
        onClick={() => setAsking(true)}
      >
        {children}
      </Button>
    );
  return (
    <span className={styles.confirm}>
      <Button
        className={styles.dangerSolid}
        loading={loading}
        onClick={() => {
          onConfirm();
          setAsking(false);
        }}
        autoFocus
      >
        {confirmLabel}
      </Button>
      <Button variant="ghost" onClick={() => setAsking(false)}>
        Hủy
      </Button>
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {hint && <span className={styles.statHint}>{hint}</span>}
    </div>
  );
}

/** Thanh tiến độ theo hợp đồng effects.css (data-tv-progress="fill"). value 0–1. */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className="tv-progress"
      data-tv-progress="fill"
      style={{ ['--value' as string]: v }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
    >
      <div className="tv-progress__bar" />
    </div>
  );
}
