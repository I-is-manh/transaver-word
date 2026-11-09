import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { expireImpersonations, resetDb } from './db';

export const worker = setupWorker(...handlers);

// Tiện cho dev: gõ window.__tvResetMocks() trong console để xóa dữ liệu giả.
(window as unknown as { __tvResetMocks: () => void }).__tvResetMocks = resetDb;
(window as unknown as { __tvExpireImpersonation: () => void }).__tvExpireImpersonation =
  expireImpersonations;
