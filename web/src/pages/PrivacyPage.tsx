import { Link } from 'react-router-dom';
import { CornerAppearanceSwitcher } from '@/components/AppearanceSwitcher';
import { Logo } from '@/components/Logo';
import styles from './Privacy.module.css';

/** Chính sách quyền riêng tư: trang công khai, không cần đăng nhập. */
export function PrivacyPage() {
  return (
    <div className={`${styles.page} tv-page`}>
      <CornerAppearanceSwitcher />
      <article className={styles.article}>
        <Link to="/" aria-label="Về trang chủ">
          <Logo />
        </Link>
        <h1>Chính sách quyền riêng tư</h1>
        <p className={styles.updated}>Cập nhật ngày 08/11/2026</p>

        <h2>Chúng tôi lưu những gì</h2>
        <ul>
          <li>
            <strong>Tài khoản:</strong> email, mật khẩu (đã mã hóa, không ai đọc được), múi giờ.
          </li>
          <li>
            <strong>Từ bạn lưu:</strong> từ, nghĩa, câu chứa từ và (nếu bạn bật) link cùng tiêu đề
            trang web nơi bạn gặp từ. Tắt trong Cài đặt, mục “Lưu link và tiêu đề trang web”.
          </li>
          <li>
            <strong>Lịch sử học:</strong> các lượt ôn, kết quả, streak, XP, huy hiệu, để tính lịch
            ôn và thống kê cho bạn.
          </li>
          <li>
            <strong>Cài đặt:</strong> mục tiêu, giờ nhắc, dạng bài, mức ghi nhớ.
          </li>
        </ul>

        <h2>Extension làm gì với trang web bạn đọc</h2>
        <ul>
          <li>Chỉ đọc đoạn bạn bôi đen, và chỉ khi bạn bấm icon dịch.</li>
          <li>
            Đoạn đó được gửi tới dịch vụ dịch MyMemory để lấy bản dịch. Chỉ khi bạn bấm{' '}
            <strong>Lưu</strong>, từ và câu chứa từ mới được gửi về máy chủ Transaver.
          </li>
          <li>
            Danh sách từ đang học được lưu ngay trong trình duyệt để gạch chân khi bạn đọc. Việc so
            khớp diễn ra trên máy bạn, không gửi nội dung trang đi đâu. Tắt trong popup của
            extension.
          </li>
        </ul>

        <h2>Chúng tôi không làm gì</h2>
        <ul>
          <li>Không bán hay chia sẻ dữ liệu của bạn cho bên thứ ba.</li>
          <li>Không theo dõi lịch sử duyệt web của bạn.</li>
          <li>
            Không gửi email quảng cáo. Email chỉ dùng để nhắc học và báo cáo tuần, tắt được trong
            Cài đặt.
          </li>
        </ul>

        <h2>Xóa dữ liệu</h2>
        <p>
          Vào <Link to="/settings">Cài đặt, mục Xóa tài khoản</Link>. Toàn bộ dữ liệu bị xóa vĩnh
          viễn ngay lập tức, mọi phiên đăng nhập (kể cả extension) bị thu hồi. Từ bạn xóa lẻ nằm
          trong thùng rác 30 ngày rồi tự xóa hẳn.
        </p>
      </article>
    </div>
  );
}
