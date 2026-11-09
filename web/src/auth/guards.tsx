import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { isAdminRole } from '@/api/types';
import { useAuth } from './authContext';

/** Trang cần đăng nhập. Chưa đăng nhập → /login, nhớ trang định vào. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'guest') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** Trang chỉ dành cho khách (/login, /register). Đã đăng nhập → về trang định vào, mặc định trang chủ. */
export function GuestOnly() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated') {
    const from = (location.state as { from?: unknown } | null)?.from;
    const target = typeof from === 'string' && from.startsWith('/') ? from : '/';
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}

/** Chưa làm onboarding → /onboarding (contract mục 10). */
export function RequireOnboarded() {
  const { user } = useAuth();
  if (user && !user.onboarding_completed) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/** Chỉ admin và superadmin. Đang impersonate thì /admin/* bị chặn ở server, nên cũng không vào. */
export function RequireAdmin() {
  const { user, impersonating } = useAuth();
  if (!isAdminRole(user?.role) || impersonating) return <Navigate to="/" replace />;
  return <Outlet />;
}
