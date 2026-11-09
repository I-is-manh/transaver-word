import wordmark from '@brand/logos/transaver-wordmark.svg';
import wordmarkDark from '@brand/logos/transaver-wordmark-dark.svg';
import { useAppearance } from './appearanceContext';

/** Logo chữ lấy từ brand/logos, đổi bản tối theo chế độ thực tế (gồm cả lựa chọn trong app). */
export function Logo({ height = 28 }: { height?: number }) {
  const { mode } = useAppearance();
  return (
    <picture>
      <img
        src={mode === 'dark' ? wordmarkDark : wordmark}
        alt="Transaver Word"
        height={height}
        style={{ display: 'block', width: 'auto' }}
      />
    </picture>
  );
}
