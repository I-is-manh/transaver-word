import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Màu và logo lấy thẳng từ brand/ ở gốc repo (không chép lại mã màu).
const brandDir = fileURLToPath(new URL('../brand', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@brand': brandDir,
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: ['.', brandDir] },
  },
});
