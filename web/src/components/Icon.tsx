import type { CSSProperties } from 'react';
import styles from './Icon.module.css';

// Icon thương hiệu trong brand/icons (nét vẽ cố định màu) → hiển thị bằng CSS mask để đổi màu theo token.
const urls = import.meta.glob('../../../brand/icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const ICONS: Record<string, string> = Object.fromEntries(
  Object.entries(urls).map(([path, url]) => [path.split('/').pop()!.replace('.svg', ''), url]),
);

export type IconName =
  | 'audio'
  | 'badge'
  | 'calendar'
  | 'check'
  | 'close'
  | 'context'
  | 'copy'
  | 'deck'
  | 'highlight'
  | 'progress'
  | 'reminder'
  | 'review'
  | 'saved'
  | 'save'
  | 'search'
  | 'settings'
  | 'streak'
  | 'swap'
  | 'translate'
  | 'xp';

export function Icon({
  name,
  size = 20,
  className,
  label,
}: {
  name: IconName | string;
  size?: number;
  className?: string;
  /** Có label thì icon được đọc bởi trình đọc màn hình, không thì ẩn. */
  label?: string;
}) {
  const url = ICONS[name] ?? ICONS.badge;
  const style = { '--icon-url': `url("${url}")`, width: size, height: size } as CSSProperties;
  return (
    <span
      className={[styles.icon, className ?? ''].filter(Boolean).join(' ')}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
