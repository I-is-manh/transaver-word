import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ME_QUERY_KEY } from '@/auth/AuthProvider';
import { useAuth } from '@/auth/authContext';
import { AuthLayout } from './AuthLayout';
import styles from './authForm.module.css';

/** Trạng thái backend gửi về sau khi bấm nút trong email (mục 2.7) */
const RESULTS: Record<string, { title: string; text: string; ok: boolean }> = {
  success: {
    title: 'Đã xác nhận email',
    text: 'Cảm ơn bạn! Email của bạn đã được xác nhận.',
    ok: true,
  },
  already: {
    title: 'Email đã được xác nhận',
    text: 'Email này đã được xác nhận từ trước.',
    ok: true,
  },
  expired: {
    title: 'Liên kết đã hết hạn',
    text: 'Liên kết xác nhận đã hết hạn hoặc không hợp lệ. Đăng nhập rồi bấm “Gửi lại email” để nhận liên kết mới.',
    ok: false,
  },
  invalid: {
    title: 'Liên kết không hợp lệ',
    text: 'Liên kết xác nhận không đúng. Đăng nhập rồi bấm “Gửi lại email” để nhận liên kết mới.',
    ok: false,
  },
};

/** /email-verified?status=… : trang công khai, mở được cả khi chưa đăng nhập (bấm từ email trên máy khác). */
export function EmailVerifiedPage() {
  const [params] = useSearchParams();
  const { status } = useAuth();
  const qc = useQueryClient();
  const result = RESULTS[params.get('status') ?? ''] ?? RESULTS.invalid!;

  // Đang đăng nhập ở tab này: tải lại /me để thanh nhắc biến mất.
  useEffect(() => {
    void qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
  }, [qc]);

  return (
    <AuthLayout
      title={result.title}
      footer={
        status === 'authenticated' ? (
          <Link to="/">Vào Transaver Word</Link>
        ) : (
          <Link to="/login">Đăng nhập</Link>
        )
      }
    >
      <p
        className={result.ok ? undefined : styles.formError}
        role={result.ok ? 'status' : 'alert'}
        style={{ marginTop: 'var(--space-5)' }}
      >
        {result.text}
      </p>
    </AuthLayout>
  );
}
