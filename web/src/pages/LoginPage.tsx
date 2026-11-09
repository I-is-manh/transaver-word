import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/authContext';
import { Button } from '@/components/Button';
import { GoogleButton } from '@/components/GoogleButton';
import { TextField } from '@/components/TextField';
import { AuthLayout } from './AuthLayout';
import { useFormErrors } from './useFormErrors';
import styles from './authForm.module.css';

const FIELDS = ['email', 'password'] as const;

export function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { fieldErrors, formError, reset, fromError, clearField } = useFormErrors(FIELDS);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    reset();
    setSubmitting(true);
    try {
      // Thành công: GuestOnly tự chuyển về trang định vào.
      await login({ email: email.trim(), password });
    } catch (err) {
      fromError(err);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Đăng nhập"
      subtitle="Tiếp tục ôn những từ bạn đã lưu."
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Link to="/register" state={location.state}>
            Đăng ký
          </Link>
        </>
      }
    >
      <GoogleButton />
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearField('email');
          }}
          error={fieldErrors.email}
        />
        <TextField
          label="Mật khẩu"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearField('password');
          }}
          error={fieldErrors.password}
        />
        <Button type="submit" block loading={submitting}>
          Đăng nhập
        </Button>
      </form>
    </AuthLayout>
  );
}
