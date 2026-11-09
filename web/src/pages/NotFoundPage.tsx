import { Link } from 'react-router-dom';
import styles from './PlaceholderPage.module.css';

export function NotFoundPage() {
  return (
    <section>
      <h1 className={styles.title}>Không tìm thấy trang</h1>
      <p className={styles.text}>
        Đường dẫn không tồn tại. <Link to="/">Về trang chủ</Link>
      </p>
    </section>
  );
}
