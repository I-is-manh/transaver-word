import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastOptions } from './toastContext';
import styles from './Toast.module.css';

interface ToastItem extends ToastOptions {
  id: number;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback(
    (id: number) => setItems((all) => all.filter((t) => t.id !== id)),
    [],
  );

  const show = useCallback(
    (opts: ToastOptions) => {
      const id = ++seq.current;
      setItems((all) => [...all.slice(-3), { ...opts, id }]);
      window.setTimeout(() => dismiss(id), opts.duration ?? (opts.action ? 6000 : 3500));
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.region} role="region" aria-label="Thông báo" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`${styles.toast} ${styles[t.tone ?? 'info']}`}>
            {t.icon}
            <div className={styles.body}>
              {t.title && <strong className={styles.title}>{t.title}</strong>}
              <span>{t.message}</span>
            </div>
            {t.action && (
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              className={styles.close}
              aria-label="Đóng thông báo"
              onClick={() => dismiss(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
