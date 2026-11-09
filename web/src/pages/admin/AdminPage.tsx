import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/endpoints';
import type { AdminUser, Role } from '@/api/types';
import { useAuth } from '@/auth/authContext';
import { Button } from '@/components/Button';
import { useToast } from '@/components/toastContext';
import {
  Chip,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
  Stat,
} from '@/components/ui';
import { formatDate, formatDateTime, formatDay, formatNumber } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';
import wordStyles from '../words/Words.module.css';
import styles from './Admin.module.css';

const ROLE_LABEL: Record<Role, string> = {
  user: 'Người dùng',
  admin: 'Quản trị',
  superadmin: 'Superadmin',
};

export function AdminPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const isSuper = user?.role === 'superadmin';
  const tab = isSuper && params.get('tab') === 'logs' ? 'logs' : 'users';
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminApi.stats });

  return (
    <>
      <PageHeader title="Quản trị" subtitle="Số liệu chung và quản lý tài khoản." />
      {stats.isPending ? (
        <Skeleton lines={2} />
      ) : stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <section className={styles.tiles}>
          <Stat label="Người dùng" value={formatNumber(stats.data.users_total)} />
          <Stat label="Hoạt động 7 ngày" value={formatNumber(stats.data.users_active_7d)} />
          <Stat label="Tổng số từ" value={formatNumber(stats.data.words_total)} />
          <Stat label="Lượt ôn hôm nay" value={formatNumber(stats.data.reviews_today)} />
          <Stat label="Lượt ôn 7 ngày" value={formatNumber(stats.data.reviews_7d)} />
        </section>
      )}

      {isSuper && (
        <div className={styles.tabs} role="tablist" aria-label="Mục quản trị">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'users'}
            className={tab === 'users' ? styles.tabOn : styles.tab}
            onClick={() => setParams({})}
          >
            Người dùng
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'logs'}
            className={tab === 'logs' ? styles.tabOn : styles.tab}
            onClick={() => setParams({ tab: 'logs' })}
          >
            Nhật ký đăng nhập với tư cách
          </button>
        </div>
      )}

      {tab === 'users' ? <UsersTab /> : <LogsTab />}
    </>
  );
}

function UsersTab() {
  const { user, impersonate } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminUser | null>(null);
  const query = useDebounced(q.trim());
  const isSuper = user?.role === 'superadmin';
  const users = useQuery({
    queryKey: ['admin', 'users', query, page],
    queryFn: () => adminApi.users(query, page),
    placeholderData: keepPreviousData,
  });
  const update = useMutation({
    mutationFn: ({
      u,
      patch,
    }: {
      u: AdminUser;
      patch: Partial<Pick<AdminUser, 'status' | 'role'>>;
    }) => adminApi.updateUser(u.id, patch),
    onSuccess: ({ user: u }) => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
      toast.show({
        tone: 'success',
        message: `Đã cập nhật ${u.email}: ${u.status === 'banned' ? 'đã khóa' : 'đang hoạt động'}, ${ROLE_LABEL[u.role]}.`,
      });
    },
    onError: (e) => toast.show({ tone: 'error', message: (e as Error).message }),
  });
  const start = useMutation({
    mutationFn: (u: AdminUser) => impersonate(u.id),
    onSuccess: (u) => {
      setTarget(null);
      toast.show({ tone: 'info', message: `Đang xem với tư cách ${u.email}.` });
      navigate('/', { replace: true });
    },
    onError: (e) => {
      setTarget(null);
      toast.show({ tone: 'error', message: (e as Error).message });
    },
  });

  return (
    <>
      <div className={wordStyles.toolbar}>
        <label className={wordStyles.search}>
          <span className="sr-only">Tìm theo email</span>
          <input
            type="search"
            placeholder="Tìm theo email…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      {users.isPending ? (
        <Skeleton lines={6} />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : (
        <>
          <div className={wordStyles.tableWrap}>
            <table className={`${wordStyles.table} ${styles.usersTable}`}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Số từ</th>
                  <th>Hoạt động</th>
                  <th className={wordStyles.actionsCol}>
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.data.data.map((u) => {
                  const self = u.id === user?.id;
                  // Admin thường không thao tác trên superadmin (mục 9.1)
                  const locked = self || (!isSuper && u.role === 'superadmin');
                  const lockReason = self
                    ? 'Không thể tự đổi quyền hoặc tự khóa tài khoản của mình'
                    : locked
                      ? 'Chỉ superadmin mới sửa được tài khoản superadmin'
                      : undefined;
                  const canImpersonate =
                    isSuper && !self && u.role !== 'superadmin' && u.status !== 'banned';
                  const roles: Role[] = isSuper
                    ? ['user', 'admin', 'superadmin']
                    : ['user', 'admin'];
                  return (
                    <tr key={u.id}>
                      <td>
                        <span className={styles.email}>{u.email}</span> {self && <Chip>Bạn</Chip>}
                      </td>
                      <td>
                        <label className="sr-only" htmlFor={`role-${u.id}`}>
                          Vai trò của {u.email}
                        </label>
                        <select
                          id={`role-${u.id}`}
                          className={styles.roleSelect}
                          value={u.role}
                          disabled={locked || update.isPending}
                          title={lockReason}
                          onChange={(e) =>
                            update.mutate({ u, patch: { role: e.target.value as Role } })
                          }
                        >
                          {(roles.includes(u.role) ? roles : [...roles, u.role]).map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {u.status === 'banned' ? (
                          <Chip tone="danger">Đã khóa</Chip>
                        ) : (
                          <Chip tone="brand">Hoạt động</Chip>
                        )}
                      </td>
                      <td>{formatNumber(u.words_count)}</td>
                      <td>
                        <div className={styles.dates}>
                          <span>
                            Gần nhất:{' '}
                            {u.last_active_date ? formatDay(u.last_active_date, true) : '—'}
                          </span>
                          <small>Tạo ngày {formatDate(u.created_at)}</small>
                        </div>
                      </td>
                      <td className={wordStyles.actionsCol}>
                        <div className={styles.actions}>
                          {canImpersonate && (
                            <Button variant="secondary" onClick={() => setTarget(u)}>
                              Đăng nhập với tư cách
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            className={u.status === 'banned' ? undefined : wordStyles.deleteBtn}
                            disabled={locked}
                            title={lockReason}
                            onClick={() =>
                              update.mutate({
                                u,
                                patch: { status: u.status === 'banned' ? 'active' : 'banned' },
                              })
                            }
                          >
                            {u.status === 'banned' ? 'Mở khóa' : 'Khóa'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={users.data.meta.current_page}
            lastPage={users.data.meta.last_page}
            total={users.data.meta.total}
            onPage={setPage}
          />
        </>
      )}

      {target && (
        <ConfirmImpersonate
          target={target}
          loading={start.isPending}
          onCancel={() => setTarget(null)}
          onConfirm={() => start.mutate(target)}
        />
      )}
    </>
  );
}

function ConfirmImpersonate({
  target,
  loading,
  onCancel,
  onConfirm,
}: {
  target: AdminUser;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="imp-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id="imp-title" className={styles.dialogTitle}>
        Đăng nhập với tư cách {target.email}?
      </h2>
      <ul className={styles.dialogList}>
        <li>
          Bạn sẽ thấy app đúng như người này thấy. <strong>Mọi thao tác</strong> (ôn tập, lưu hay
          xóa từ, đổi cài đặt…) sẽ <strong>ghi vào dữ liệu của người này</strong>.
        </li>
        <li>
          Phiên tự hết hạn sau 2 giờ. Không xóa tài khoản và không vào trang quản trị được trong lúc
          này.
        </li>
        <li>Lượt đăng nhập này được ghi vào nhật ký.</li>
      </ul>
      <div className={styles.dialogActions}>
        <Button variant="ghost" onClick={onCancel} autoFocus>
          Hủy
        </Button>
        <Button onClick={onConfirm} loading={loading}>
          Đăng nhập với tư cách
        </Button>
      </div>
    </dialog>
  );
}

function LogsTab() {
  const [page, setPage] = useState(1);
  const logs = useQuery({
    queryKey: ['admin', 'impersonations', page],
    queryFn: () => adminApi.impersonations(page),
    placeholderData: keepPreviousData,
  });
  if (logs.isPending) return <Skeleton lines={5} />;
  if (logs.isError) return <ErrorState error={logs.error} onRetry={() => void logs.refetch()} />;
  if (logs.data.data.length === 0)
    return <EmptyState title="Chưa có lượt đăng nhập với tư cách nào" />;
  return (
    <>
      <div className={wordStyles.tableWrap}>
        <table className={wordStyles.table}>
          <thead>
            <tr>
              <th>Superadmin</th>
              <th>Tài khoản được xem</th>
              <th>Bắt đầu</th>
              <th>Kết thúc</th>
            </tr>
          </thead>
          <tbody>
            {logs.data.data.map((l) => (
              <tr key={l.id}>
                <td>{l.impersonator_email}</td>
                <td>{l.user_email}</td>
                <td>{formatDateTime(l.started_at)}</td>
                <td>
                  {l.ended_at ? (
                    formatDateTime(l.ended_at)
                  ) : (
                    <Chip tone="accent">Đang diễn ra</Chip>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={logs.data.meta.current_page}
        lastPage={logs.data.meta.last_page}
        total={logs.data.meta.total}
        onPage={setPage}
      />
    </>
  );
}
