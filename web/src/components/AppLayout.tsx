import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { isAdminRole } from '@/api/types';
import { useAuth } from '@/auth/authContext';
import { AppearanceSwitcher } from './AppearanceSwitcher';
import { Button } from './Button';
import { EmailVerifyBanner } from './EmailVerifyBanner';
import { Logo } from './Logo';
import styles from './AppLayout.module.css';

const NAV = [
  { to: '/review', label: 'Ôn tập' },
  { to: '/words', label: 'Từ của tôi' },
  { to: '/decks', label: 'Deck' },
  { to: '/stats', label: 'Thống kê' },
  { to: '/settings', label: 'Cài đặt' },
];

export function AppLayout() {
  const { user, logout, impersonating } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const nav =
    isAdminRole(user?.role) && !impersonating ? [...NAV, { to: '/admin', label: 'Quản trị' }] : NAV;
  return (
    <div className={`${styles.shell} tv-page`}>
      <header className={styles.header}>
        <div className={styles.inner}>
          <NavLink to="/" end className={styles.brand} aria-label="Trang chủ Transaver Word">
            <Logo />
          </NavLink>
          <nav className={styles.nav} aria-label="Điều hướng chính">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? `${styles.link} ${styles.active}` : styles.link
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <AppearanceSwitcher />
          {user && (
            <div className={styles.account}>
              <span
                className={
                  nav.length > NAV.length ? `${styles.user} ${styles.userHidden}` : styles.user
                }
                title={user.email}
              >
                {user.email}
              </span>
              {!impersonating && (
                <Button
                  variant="ghost"
                  title={`Đăng xuất khỏi ${user.email}`}
                  loading={leaving}
                  onClick={async () => {
                    setLeaving(true);
                    await logout();
                  }}
                >
                  Đăng xuất
                </Button>
              )}
            </div>
          )}
        </div>
      </header>
      <main className={styles.main}>
        <EmailVerifyBanner />
        <Outlet />
      </main>
    </div>
  );
}
