import { describe, expect, it } from 'vitest';
import worker from '../src/workers/api';
import { WorkerEnv } from '../src/workers/pipeline';

const mockEnv: WorkerEnv = {
  DB: {
    prepare: () => ({
      first: async () => null,
      all: async () => ({ results: [] }),
      run: async () => ({ success: true }),
      bind: () => ({
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({ success: true }),
      }),
    }),
  } as unknown as D1Database,
  ADMIN_SECRET: 'test-admin-secret-2026',
  INGEST_API_KEY: 'mock-ingest-key',
};

const mockCtx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

describe('Ingest API Security & Source Restrictions', () => {
  it('rejects unauthenticated requests to POST /api/ingest with 401', async () => {
    const req = new Request('http://localhost/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posts: [] }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(401);
    const data = (await res.json()) as { success: boolean; error: string };
    expect(data.success).toBe(false);
    expect(data.error).toContain('Valid ingest API key or admin token required');
  });

  it('rejects unauthenticated requests to POST /api/ingest/check with 401', async () => {
    const req = new Request('http://localhost/api/ingest/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: ['https://example.com'] }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(401);
    const data = (await res.json()) as { success: boolean; error: string };
    expect(data.success).toBe(false);
  });

  it('accepts valid INGEST_API_KEY via Authorization Bearer token', async () => {
    const req = new Request('http://localhost/api/ingest/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock-ingest-key',
      },
      body: JSON.stringify({ urls: [] }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; existingUrls: string[] };
    expect(data.success).toBe(true);
    expect(data.existingUrls).toEqual([]);
  });

  it('accepts valid INGEST_API_KEY via X-Ingest-Key header', async () => {
    const req = new Request('http://localhost/api/ingest/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ingest-Key': 'mock-ingest-key',
      },
      body: JSON.stringify({ urls: [] }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean };
    expect(data.success).toBe(true);
  });

  it('rejects invalid API key with 401', async () => {
    const req = new Request('http://localhost/api/ingest/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer wrong-key',
      },
      body: JSON.stringify({ urls: [] }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(401);
  });

  it('rejects non-macro sources (e.g. facebook-creator) in POST /api/ingest', async () => {
    const req = new Request('http://localhost/api/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock-ingest-key',
      },
      body: JSON.stringify({
        posts: [
          {
            source: 'facebook-creator',
            title: 'Sample Facebook Post',
            url: 'https://facebook.com/sample',
            body: 'Post content',
          },
        ],
      }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; insertedCount: number; errors: string[] };
    expect(data.success).toBe(true);
    expect(data.insertedCount).toBe(0);
    expect(data.errors.length).toBeGreaterThan(0);
    expect(data.errors[0]).toContain('Disallowed source "facebook-creator"');
  });
});
