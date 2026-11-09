import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/authContext';
import { Button } from './Button';
import styles from './ImpersonationBanner.module.css';

/** Thanh cảnh báo cố định đầu mọi trang khi superadmin đang xem với tư cách người khác (mục 9.1). */
export function ImpersonationBanner() {
  const { user, impersonating, stopImpersonation } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  // Chừa chỗ cho thanh cố định: header sticky và nội dung dịch xuống
  useEffect(() => {
    document.documentElement.classList.toggle('tv-impersonating', impersonating);
    return () => document.documentElement.classList.remove('tv-impersonating');
  }, [impersonating]);

  if (!impersonating || !user) return null;
  return (
    <div className={styles.bar} role="alert">
      <span className={styles.text}>
        Bạn đang xem với tư cách <strong>{user.email}</strong>. Mọi thao tác sẽ ghi vào dữ liệu của
        người này.
      </span>
      <Button
        variant="secondary"
        className={styles.back}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          await stopImpersonation();
          setBusy(false);
          navigate('/admin', { replace: true });
        }}
      >
        Quay lại tài khoản của tôi
      </Button>
    </div>
  );
}
