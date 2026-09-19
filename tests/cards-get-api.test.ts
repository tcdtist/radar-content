import { describe, expect, it, vi } from 'vitest';
import worker from '../src/workers/api';
import { WorkerEnv } from '../src/workers/pipeline';

describe('Cards Detail Query API (GET /api/cards/:id)', () => {
  const testEnv: WorkerEnv = {
    DB: {
      prepare: vi.fn().mockImplementation((_sql: string) => {
        return {
          bind: vi.fn().mockImplementation((...params: unknown[]) => {
            return {
              first: async () => {
                if (params[0] === 'cluster_live_1') {
                  return {
                    id: 'cluster_live_1',
                    label: 'Live Cluster Card',
                    topic_tags: JSON.stringify(['AI']),
                    score: 85,
                    status: 'READY',
                    article_count: 5,
                    source_count: 2,
                    created_at: 1789700000,
                    updated_at: 1789710000,
                    summary: 'Live D1 cluster card summary',
                    evidence: JSON.stringify(['Evidence 1']),
                    counter: JSON.stringify(['Counter 1']),
                    context: JSON.stringify(['Context 1']),
                    verification_questions: JSON.stringify(['Question 1?']),
                  };
                }
                return null;
              },
              all: async () => ({ results: [] }),
            };
          }),
        };
      }),
    } as unknown as D1Database,
  };

  const mockCtx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  it('returns card details with 200 OK when found in D1', async () => {
    const req = new Request('http://localhost/api/cards/cluster_live_1', { method: 'GET' });
    const res = await worker.fetch(req, testEnv, mockCtx);

    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; card?: { id: string; label: string } };
    expect(data.success).toBe(true);
    expect(data.card?.id).toBe('cluster_live_1');
    expect(data.card?.label).toBe('Live Cluster Card');
  });

  it('falls back to mock snapshot card if not found in D1', async () => {
    const req = new Request('http://localhost/api/cards/cluster_comm_22', { method: 'GET' });
    const res = await worker.fetch(req, testEnv, mockCtx);

    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; card?: { id: string } };
    expect(data.success).toBe(true);
    expect(data.card?.id).toBe('cluster_comm_22');
  });

  it('returns 404 if card is not found anywhere', async () => {
    const req = new Request('http://localhost/api/cards/non_existent_cluster', { method: 'GET' });
    const res = await worker.fetch(req, testEnv, mockCtx);

    expect(res.status).toBe(404);
    const data = (await res.json()) as { success: boolean; error: string };
    expect(data.success).toBe(false);
    expect(data.error).toContain('Card not found');
  });
});
