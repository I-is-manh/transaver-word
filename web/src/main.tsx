import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { AuthProvider } from '@/auth/AuthProvider';
import { AppearanceProvider } from '@/components/AppearanceProvider';
import { ToastProvider } from '@/components/Toast';
import { App } from './App';
// Nguồn màu duy nhất: sinh từ brand/themes/themes.json, không chép lại mã màu.
import '@brand/themes/themes.css';
import '@brand/themes/effects.css';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Không thử lại với lỗi phía người dùng (4xx).
      retry: (count, err) =>
        !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

async function enableMocks() {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return;
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
  console.info(
    '[Transaver] Đang dùng dữ liệu giả (MSW). Tài khoản mẫu: demo@transaver.vn / matkhau123',
  );
}

void enableMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AuthProvider>
              <AppearanceProvider>
                <App />
              </AppearanceProvider>
            </AuthProvider>
          </ToastProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </StrictMode>,
  );
});
