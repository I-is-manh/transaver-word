import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/authContext';
import { Button } from '@/components/Button';
import { GoogleButton } from '@/components/GoogleButton';
import { TextField } from '@/components/TextField';
import { AuthLayout } from './AuthLayout';
import { useFormErrors } from './useFormErrors';
import styles from './authForm.module.css';

const FIELDS = ['email', 'password', 'password_confirmation'] as const;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

export function RegisterPage() {
  const { register } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { fieldErrors, formError, setFieldErrors, reset, fromError, clearField } =
    useFormErrors(FIELDS);

  /** Kiểm tra nhanh ở trình duyệt. Server vẫn kiểm tra lại và trả 422 nếu sai. */
  function validate(): boolean {
    const errs: Partial<Record<(typeof FIELDS)[number], string>> = {};
    const trimmed = email.trim();
    if (!trimmed) errs.email = 'Vui lòng nhập email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) errs.email = 'Email không hợp lệ.';
    if (password.length < MIN_PASSWORD)
      errs.password = `Mật khẩu phải có ít nhất ${MIN_PASSWORD} ký tự.`;
    else if (password.length > MAX_PASSWORD)
      errs.password = `Mật khẩu tối đa ${MAX_PASSWORD} ký tự.`;
    if (!errs.password && confirm !== password)
      errs.password_confirmation = 'Mật khẩu nhập lại không khớp.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    reset();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register({
        email: email.trim(),
        password,
        password_confirmation: confirm,
      });
    } catch (err) {
      fromError(err);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Tạo tài khoản"
      subtitle="Lưu từ khi đọc web, ôn đúng lúc sắp quên."
      footer={
        <>
          Đã có tài khoản?{' '}
          <Link to="/login" state={location.state}>
            Đăng nhập
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
          maxLength={255}
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
          autoComplete="new-password"
          required
          maxLength={MAX_PASSWORD}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearField('password');
          }}
          error={fieldErrors.password}
          hint={`Tối thiểu ${MIN_PASSWORD} ký tự.`}
        />
        <TextField
          label="Nhập lại mật khẩu"
          type="password"
          name="password_confirmation"
          autoComplete="new-password"
          required
          maxLength={MAX_PASSWORD}
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            clearField('password_confirmation');
          }}
          error={fieldErrors.password_confirmation}
        />
        <Button type="submit" block loading={submitting}>
          Đăng ký
        </Button>
      </form>
    </AuthLayout>
  );
}
