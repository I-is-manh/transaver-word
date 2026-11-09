import styles from './MarkedSentence.module.css';

/**
 * Câu ngữ cảnh có tô từ theo word_offset/word_length (UTF-16, như JS).
 * Chỉ in đậm + màu brand: KHÔNG nền vàng/gạch chân để khỏi giống highlight của extension.
 * Vị trí null hoặc lệch khỏi câu thì hiện câu thường.
 */
export function MarkedSentence({
  sentence,
  offset,
  length,
}: {
  sentence: string;
  offset: number | null;
  length: number | null;
}) {
  if (offset === null || length === null || offset < 0 || offset + length > sentence.length)
    return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, offset)}
      <strong className={styles.mark}>{sentence.slice(offset, offset + length)}</strong>
      {sentence.slice(offset + length)}
    </>
  );
}
