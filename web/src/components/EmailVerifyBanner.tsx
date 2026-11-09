import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { ApiError } from '@/api/client';
import { ME_QUERY_KEY } from '@/auth/AuthProvider';
import { useAuth } from '@/auth/authContext';
import { Button } from './Button';
import { useToast } from './toastContext';
import styles from './EmailVerifyBanner.module.css';

/** Nhắc xác nhận email (mục 2.7). Chưa xác nhận vẫn dùng app bình thường. */
export function EmailVerifyBanner() {
  const { user, impersonating } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  // Người dùng bấm nút trong email ở tab khác: quay lại tab này thì cập nhật trạng thái.
  useEffect(() => {
    if (!user || user.email_verified) return;
    const onFocus = () => void qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, qc]);

  if (!user || user.email_verified || impersonating) return null;

  async function resend() {
    setBusy(true);
    try {
      const res = await authApi.resendVerification();
      toast.show({ tone: res.sent ? 'success' : 'info', message: res.message });
      if (!res.sent) void qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
      setCooldown(60);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setCooldown(60);
      toast.show({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Chưa gửi được email.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.bar} role="status">
      <span className={styles.text}>
        Hãy xác nhận email <strong>{user.email}</strong>: bấm nút “Xác nhận email” trong thư chúng
        tôi đã gửi. Không thấy thư? Xem cả mục Spam.
      </span>
      <span className={styles.actions}>
        <Button variant="secondary" loading={busy} disabled={cooldown > 0} onClick={resend}>
          {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại email'}
        </Button>
      </span>
    </div>
  );
}
