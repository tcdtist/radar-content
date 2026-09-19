import { describe, expect, it } from 'vitest';
import worker from '../src/workers/api';
import { getJwtSecret, signSessionToken } from '../src/workers/auth';
import { WorkerEnv } from '../src/workers/pipeline';

const testEnv: WorkerEnv = {
  DB: {
    prepare: () => ({
      first: async () => ({ count: 5, data: '[]', sync_date: '2026-09-18' }),
      all: async () => ({ results: [] }),
      run: async () => ({ success: true, meta: { changes: 1 } }),
      bind: () => ({
        first: async () => ({ count: 5, data: '[]', sync_date: '2026-09-18' }),
        all: async () => ({ results: [] }),
        run: async () => ({ success: true, meta: { changes: 1 } }),
      }),
    }),
  } as unknown as D1Database,
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_SECRET: 'test-secret',
  JWT_SECRET: 'test-jwt-secret-key',
};

const mockCtx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

describe('Admin Maintenance & Snapshot Routes', () => {
  it('GET /api/cards returns isMock=true for guests', async () => {
    const req = new Request('http://localhost/api/cards', { method: 'GET' });
    const res = await worker.fetch(req, testEnv, mockCtx);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; isMock: boolean; cards: unknown[] };
    expect(data.success).toBe(true);
    expect(data.isMock).toBe(true);
    expect(data.cards.length).toBeLessThanOrEqual(12);
  });

  it('POST /api/admin/sync-mock rejects unauthenticated requests with 401', async () => {
    const req = new Request('http://localhost/api/admin/sync-mock', { method: 'POST' });
    const res = await worker.fetch(req, testEnv, mockCtx);
    expect(res.status).toBe(401);
  });

  it('POST /api/admin/prune rejects unauthenticated requests with 401', async () => {
    const req = new Request('http://localhost/api/admin/prune', { method: 'POST' });
    const res = await worker.fetch(req, testEnv, mockCtx);
    expect(res.status).toBe(401);
  });

  it('POST /api/admin/prune succeeds for authenticated admin with 200', async () => {
    const token = await signSessionToken(
      { email: 'admin@example.com', role: 'admin', exp: Date.now() + 3600 * 1000 },
      getJwtSecret(testEnv)
    );

    const req = new Request('http://localhost/api/admin/prune', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await worker.fetch(req, testEnv, mockCtx);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; stats: unknown };
    expect(data.success).toBe(true);
    expect(data.stats).toBeDefined();
  });
});
