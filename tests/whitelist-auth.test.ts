import { describe, expect, it } from 'vitest';
import worker from '../src/workers/api';
import { getJwtSecret, signSessionToken } from '../src/workers/auth';
import { WorkerEnv } from '../src/workers/pipeline';

const testEnv: WorkerEnv = {
  DB: {
    prepare: () => ({
      first: async () => ({ count: 10 }),
      all: async () => ({ results: [] }),
      run: async () => ({ success: true }),
      bind: () => ({
        first: async () => ({ count: 10 }),
        all: async () => ({
          results: [
            {
              id: 'clu_live_d1_01',
              label: 'Real D1 Cluster',
              topic_tags: '["AI"]',
              score: 85,
              status: 'READY',
              article_count: 2,
              source_count: 1,
              created_at: 1773000000,
              updated_at: 1773000000,
            },
          ],
        }),
        run: async () => ({ success: true }),
      }),
    }),
  } as unknown as D1Database,
  ALLOWED_EMAILS: 'admin@example.com, collaborator@example.com',
  ADMIN_SECRET: 'test-admin-secret-2026',
  JWT_SECRET: 'test-jwt-secret-whitelist',
  GOOGLE_CLIENT_ID: 'valid-google-client-id.apps.googleusercontent.com',
};

const mockCtx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

describe('Whitelist Authentication & Guest Mock Cards API', () => {
  it('GET /api/cards unauthenticated returns exactly 12 mock cards with isMock = true', async () => {
    const req = new Request('http://localhost/api/cards', { method: 'GET' });
    const res = await worker.fetch(req, testEnv, mockCtx);

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      success: boolean;
      cards: Array<{ id: string; score: number }>;
      isMock: boolean;
      limit: number;
    };
    expect(data.success).toBe(true);
    expect(data.isMock).toBe(true);
    expect(data.cards.length).toBe(12);
    expect(data.cards[0].score).toBeGreaterThanOrEqual(data.cards[1].score);
  });

  it('GET /api/cards unauthenticated supports topic filtering on mock cards', async () => {
    const req = new Request('http://localhost/api/cards?topic=AI', { method: 'GET' });
    const res = await worker.fetch(req, testEnv, mockCtx);

    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; cards: Array<{ topic_tags: string[] }>; isMock: boolean };
    expect(data.success).toBe(true);
    expect(data.isMock).toBe(true);
    expect(data.cards.length).toBeGreaterThan(0);
    data.cards.forEach((card) => {
      expect(card.topic_tags.map((t) => t.toLowerCase())).toContain('ai');
    });
  });

  it('GET /api/cards authenticated with whitelisted user returns live D1 cards with isMock = false', async () => {
    const token = await signSessionToken(
      { email: 'admin@example.com', role: 'admin', exp: Date.now() + 3600 * 1000 },
      getJwtSecret(testEnv)
    );

    const req = new Request('http://localhost/api/cards', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await worker.fetch(req, testEnv, mockCtx);

    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; isMock: boolean; cards: unknown[] };
    expect(data.success).toBe(true);
    expect(data.isMock).toBe(false);
  });

  it('POST /api/auth/login accepts secondary email in ALLOWED_EMAILS', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'collaborator@example.com',
        secret: 'test-admin-secret-2026',
      }),
    });

    const res = await worker.fetch(req, testEnv, mockCtx);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; user: { email: string } };
    expect(data.success).toBe(true);
    expect(data.user.email).toBe('collaborator@example.com');
  });

  it('POST /api/auth/login rejects unauthorized email not in whitelist', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hacker@unauthorized.com',
        secret: 'test-admin-secret-2026',
      }),
    });

    const res = await worker.fetch(req, testEnv, mockCtx);
    expect(res.status).toBe(401);
    const data = (await res.json()) as { success: boolean; error: string };
    expect(data.success).toBe(false);
    expect(data.error).toBe('Email not authorized for admin access');
  });

  it('revokes session immediately if token email is removed from ALLOWED_EMAILS', async () => {
    // Generate token for former collaborator
    const token = await signSessionToken(
      { email: 'former_member@example.com', role: 'admin', exp: Date.now() + 3600 * 1000 },
      getJwtSecret(testEnv)
    );

    // Make request with environment that only allows admin@example.com
    const restrictedEnv: WorkerEnv = {
      ...testEnv,
      ALLOWED_EMAILS: 'admin@example.com',
    };

    const req = new Request('http://localhost/api/stats', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await worker.fetch(req, restrictedEnv, mockCtx);

    expect(res.status).toBe(403);
    const data = (await res.json()) as { success: boolean; error: string };
    expect(data.error).toContain('Admin access required');
  });
});
