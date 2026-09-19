import { describe, expect, it } from 'vitest';
import { WorkerEnv } from '../src/workers/pipeline';
import worker from '../src/workers/api';
import { getJwtSecret, signSessionToken } from '../src/workers/auth';

const mockEnv: WorkerEnv = {
  DB: {
    prepare: () => ({
      first: async () => ({ count: 10 }),
      all: async () => ({ results: [] }),
      run: async () => ({ success: true }),
      bind: () => ({
        first: async () => ({ count: 10 }),
        all: async () => ({ results: [] }),
        run: async () => ({ success: true }),
      }),
    }),
  } as unknown as D1Database,
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_SECRET: 'test-admin-secret-2026',
  JWT_SECRET: 'test-jwt-secret-for-api-tests',
};

const mockCtx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

describe('Worker Hono API Routes & Auth Protection', () => {
  it('GET / returns health check payload', async () => {
    const req = new Request('http://localhost/', { method: 'GET' });
    const res = await worker.fetch(req, mockEnv, mockCtx);

    expect(res.status).toBe(200);
    const data = (await res.json()) as { name: string; status: string; version: string };
    expect(data.name).toBe('radar-content');
    expect(data.status).toBe('ok');
    expect(data.version).toBe('0.1.0');
  });

  it('GET /api/stats rejects unauthenticated public requests with 401', async () => {
    const req = new Request('http://localhost/api/stats', { method: 'GET' });
    const res = await worker.fetch(req, mockEnv, mockCtx);

    expect(res.status).toBe(401);
    const data = (await res.json()) as { success: boolean; error: string };
    expect(data.success).toBe(false);
    expect(data.error).toContain('Admin authentication required');
  });

  it('GET /api/stats allows authenticated admin requests with 200', async () => {
    const token = await signSessionToken(
      { email: 'admin@example.com', role: 'admin', exp: Date.now() + 3600 * 1000 },
      getJwtSecret(mockEnv)
    );

    const req = new Request('http://localhost/api/stats', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await worker.fetch(req, mockEnv, mockCtx);

    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; stats: unknown };
    expect(data.success).toBe(true);
    expect(data.stats).toBeDefined();
  });

  it('POST /api/cards/:id/action rejects unauthenticated requests with 401', async () => {
    const req = new Request('http://localhost/api/cards/clu_123/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'READY' }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(401);
    const data = (await res.json()) as { success: boolean; error: string };
    expect(data.success).toBe(false);
  });

  it('POST /api/cards/:id/action rejects invalid action status with 400 when admin', async () => {
    const token = await signSessionToken(
      { email: 'admin@example.com', role: 'admin', exp: Date.now() + 3600 * 1000 },
      getJwtSecret(mockEnv)
    );

    const req = new Request('http://localhost/api/cards/clu_123/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'INVALID_STATUS' }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { success: boolean; error: string };
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid card action status');
  });

  it('POST /api/crawl/trigger rejects unauthenticated requests with 401', async () => {
    const req = new Request('http://localhost/api/crawl/trigger', { method: 'POST' });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(401);
  });

  it('POST /api/process/trigger rejects unauthenticated requests with 401', async () => {
    const req = new Request('http://localhost/api/process/trigger', { method: 'POST' });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login succeeds for admin email and correct secret', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        secret: 'test-admin-secret-2026',
      }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; token: string; user: { email: string } };
    expect(data.success).toBe(true);
    expect(data.token).toBeDefined();
    expect(data.user.email).toBe('admin@example.com');
  });

  it('POST /api/auth/login rejects non-admin email with 401', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'attacker@gmail.com',
        secret: 'test-admin-secret-2026',
      }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me returns authenticated status with valid Bearer token', async () => {
    const token = await signSessionToken(
      { email: 'admin@example.com', role: 'admin', exp: Date.now() + 3600 * 1000 },
      getJwtSecret(mockEnv)
    );

    const req = new Request('http://localhost/api/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; authenticated: boolean; user?: { email: string } };
    expect(data.success).toBe(true);
    expect(data.authenticated).toBe(true);
    expect(data.user?.email).toBe('admin@example.com');

    // Unauthenticated request returns 401
    const unauthReq = new Request('http://localhost/api/auth/me', { method: 'GET' });
    const unauthRes = await worker.fetch(unauthReq, mockEnv, mockCtx);
    expect(unauthRes.status).toBe(401);
  });

  it('GET /api/auth/config returns public googleClientId', async () => {
    const customEnv: WorkerEnv = {
      ...mockEnv,
      GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
    };
    const req = new Request('http://localhost/api/auth/config', { method: 'GET' });
    const res = await worker.fetch(req, customEnv, mockCtx);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; googleClientId: string };
    expect(data.success).toBe(true);
    expect(data.googleClientId).toBe('test-client-id.apps.googleusercontent.com');
  });

  it('recognizes admin via Cf-Access-Authenticated-User-Email header', async () => {
    const req = new Request('http://localhost/api/auth/me', {
      method: 'GET',
      headers: { 'Cf-Access-Authenticated-User-Email': 'admin@example.com' },
    });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { authenticated: boolean; user?: { email: string; role: string } };
    expect(data.authenticated).toBe(true);
    expect(data.user?.role).toBe('admin');
  });
});
