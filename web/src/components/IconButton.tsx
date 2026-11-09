import type { ButtonHTMLAttributes } from 'react';
import { UiIcon, type UiIconName } from './UiIcon';
import styles from './IconButton.module.css';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: UiIconName;
  /** Vừa là aria-label vừa là chữ trong tooltip. */
  label: string;
  tone?: 'default' | 'danger';
  /** Nút bật/tắt: có giá trị thì gắn aria-pressed và tô trạng thái bật. */
  pressed?: boolean;
  /** Tooltip canh giữa (mặc định) hoặc canh mép phải nút (dùng ở cột cuối bảng). */
  tipAlign?: 'center' | 'end';
}

/** Nút icon vuông 34px kèm tooltip nhẹ (hover/focus, trễ ~300ms, không chặn click). */
export function IconButton({
  icon,
  label,
  tone = 'default',
  pressed,
  tipAlign = 'center',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <span className={styles.wrap}>
      <button
        type={type}
        data-icon-button=""
        className={[styles.button, tone === 'danger' ? styles.danger : '', className ?? '']
          .filter(Boolean)
          .join(' ')}
        aria-label={label}
        aria-pressed={pressed}
        {...rest}
      >
        <UiIcon name={icon} />
      </button>
      <span
        className={[styles.tip, tipAlign === 'end' ? styles.tipEnd : ''].filter(Boolean).join(' ')}
        aria-hidden="true"
      >
        {label}
      </span>
    </span>
  );
}
