import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/authContext';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { AuthLayout } from './AuthLayout';
import styles from './authForm.module.css';

/** Mã lỗi backend gửi về qua ?error= (mục 2.6) */
const ERRORS: Record<string, string> = {
  cancelled: 'Bạn đã hủy đăng nhập bằng Google.',
  failed: 'Không đăng nhập được bằng Google. Vui lòng thử lại.',
  email_unverified: 'Email Google của bạn chưa được xác minh.',
  banned: 'Tài khoản này đã bị khóa.',
  not_configured: 'Đăng nhập bằng Google chưa được cấu hình trên máy chủ.',
};

/** /auth/google/callback: nhận mã một lần từ backend, đổi lấy phiên đăng nhập. */
export function GoogleCallbackPage() {
  const [params] = useSearchParams();
  const { loginWithGoogleCode } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(() => {
    const code = params.get('error');
    if (code) return ERRORS[code] ?? ERRORS.failed!;
    return params.get('code') ? null : ERRORS.failed!;
  });
  const started = useRef(false);

  useEffect(() => {
    const code = params.get('code');
    if (!code || error || started.current) return;
    started.current = true; // StrictMode gọi effect hai lần; mã chỉ dùng được một lần
    loginWithGoogleCode(code)
      .then(() => navigate('/', { replace: true })) // tài khoản mới: RequireOnboarded tự chuyển tới /onboarding
      .catch((err: unknown) => {
        setError(err instanceof Error && err.message ? err.message : ERRORS.failed!);
      });
  }, [params, error, loginWithGoogleCode, navigate]);

  if (!error) return <FullPageSpinner />;

  return (
    <AuthLayout
      title="Đăng nhập bằng Google"
      footer={<Link to="/login">Quay lại trang đăng nhập</Link>}
    >
      <p className={styles.formError} role="alert" style={{ marginTop: 'var(--space-5)' }}>
        {error}
      </p>
    </AuthLayout>
  );
}
