import { describe, expect, it, vi } from 'vitest';
import worker from '../src/workers/api';
import { getJwtSecret, signSessionToken } from '../src/workers/auth';
import { WorkerEnv } from '../src/workers/pipeline';

describe('Cards Translation API (POST /api/cards/:id/translate)', () => {
  const testEnv: WorkerEnv = {
    DB: {
      prepare: vi.fn().mockImplementation((sql: string) => {
        return {
          bind: vi.fn().mockImplementation((...params: any[]) => {
            return {
              first: async () => {
                // If checking translation cache for cluster_cached_1
                if (sql.includes('card_translations') && params[0] === 'cluster_cached_1') {
                  return {
                    card_id: 'cluster_cached_1',
                    lang: 'vi',
                    summary: 'Bản dịch đã cache trong D1.',
                    evidence: JSON.stringify(['Bằng chứng cache 1']),
                    counter: JSON.stringify(['Phản biện cache 1']),
                    context: JSON.stringify(['Bối cảnh cache 1']),
                    verification_questions: JSON.stringify(['Câu hỏi cache 1']),
                    translated_at: 1789700000,
                  };
                }
                return null;
              },
              all: async () => ({ results: [] }),
              run: async () => ({ success: true, meta: { changes: 1 } }),
            };
          }),
        };
      }),
    } as unknown as D1Database,
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_SECRET: 'test-secret',
    JWT_SECRET: 'test-jwt-secret-key',
    GEMINI_API_KEY: 'test-gemini-key',
  };

  const mockCtx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  it('rejects unauthenticated requests with 401 Unauthorized', async () => {
    const req = new Request('http://localhost/api/cards/cluster_comm_22/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await worker.fetch(req, testEnv, mockCtx);
    expect(res.status).toBe(401);
  });

  it('returns cached translation immediately if found in D1 with isCached=true', async () => {
    const token = await signSessionToken(
      { email: 'admin@example.com', role: 'admin', exp: Date.now() + 3600 * 1000 },
      getJwtSecret(testEnv)
    );

    const req = new Request('http://localhost/api/cards/cluster_cached_1/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    const res = await worker.fetch(req, testEnv, mockCtx);
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      success: boolean;
      isCached: boolean;
      translation: { summary: string; evidence: string[] };
    };

    expect(data.success).toBe(true);
    expect(data.isCached).toBe(true);
    expect(data.translation.summary).toBe('Bản dịch đã cache trong D1.');
    expect(data.translation.evidence).toEqual(['Bằng chứng cache 1']);
  });

  it('translates card on cache miss when card payload is supplied', async () => {
    // Mock global fetch to emulate Gemini API response
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('generativelanguage.googleapis.com')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          summary: 'Bản dịch tiếng Việt mới sinh từ Gemini.',
                          evidence: ['Throughput đạt 150 token/s'],
                          counter: ['Latency cao ở p99'],
                          context: ['Cạnh tranh thị trường LLM'],
                          verification_questions: ['Kiểm tra benchmark GPU'],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return originalFetch(url);
    });

    try {
      const token = await signSessionToken(
        { email: 'admin@example.com', role: 'admin', exp: Date.now() + 3600 * 1000 },
        getJwtSecret(testEnv)
      );

      const req = new Request('http://localhost/api/cards/cluster_new_99/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          card: {
            label: 'Test Card',
            summary: 'English summary here',
            evidence: ['150 token/s'],
            counter: ['High latency'],
            context: ['Market context'],
            verification_questions: ['Verify test'],
          },
        }),
      });

      const res = await worker.fetch(req, testEnv, mockCtx);
      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        success: boolean;
        isCached: boolean;
        translation: { summary: string; evidence: string[] };
      };

      expect(data.success).toBe(true);
      expect(data.isCached).toBe(false);
      expect(data.translation.summary).toBe('Bản dịch tiếng Việt mới sinh từ Gemini.');
      expect(data.translation.evidence).toEqual(['Throughput đạt 150 token/s']);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
