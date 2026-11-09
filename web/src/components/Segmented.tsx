import { useId } from 'react';
import styles from './Segmented.module.css';

/** Nhóm nút chọn một (radio) dạng segmented — dùng chung cho "Loại", "Nhóm theo"… */
export function Segmented<T extends string>({
  label,
  showLabel = true,
  options,
  value,
  onChange,
  size = 'md',
  labelVariant = 'form',
}: {
  label: string;
  /** false: nhãn chỉ dành cho trình đọc màn hình */
  showLabel?: boolean;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  /** 'form': nhãn như TextField; 'toolbar': nhãn nhỏ như Select trên thanh lọc */
  labelVariant?: 'form' | 'toolbar';
}) {
  const name = useId();
  return (
    <fieldset
      className={[styles.field, labelVariant === 'toolbar' ? styles.fieldToolbar : '']
        .filter(Boolean)
        .join(' ')}
    >
      <legend
        className={
          showLabel ? (labelVariant === 'toolbar' ? styles.labelToolbar : styles.label) : 'sr-only'
        }
      >
        {label}
      </legend>
      <div className={[styles.group, size === 'sm' ? styles.sm : ''].filter(Boolean).join(' ')}>
        {options.map((o) => (
          <label key={o.value} className={styles.segment}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
