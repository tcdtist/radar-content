import { describe, expect, it, vi } from 'vitest';
import { sealStaleClusters, upsertCluster } from '../src/lib/db/cluster-mutations';
import { CardStatus, makeClusterId } from '../src/lib/db/types';
import { ClusterBuilder, SEAL_WINDOW_SECONDS } from '../src/lib/graph/cluster-builder';

describe('Cluster Seal & Topic Lifecycle (Phase 01)', () => {
  it('defines SEAL_WINDOW_SECONDS as 7 days (604,800 seconds)', () => {
    expect(SEAL_WINDOW_SECONDS).toBe(7 * 86400);
  });

  it('sealStaleClusters updates status to SEALED for clusters older than 7 days', async () => {
    let capturedSql = '';
    let capturedCutoff = 0;

    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        capturedSql = sql;
        return {
          bind: vi.fn().mockImplementation((cutoff: number) => {
            capturedCutoff = cutoff;
            return {
              run: async () => ({ success: true, meta: { changes: 5 } }),
            };
          }),
        };
      }),
    } as unknown as D1Database;

    const changes = await sealStaleClusters(mockDb, 7 * 86400);

    expect(changes).toBe(5);
    expect(capturedSql).toContain("SET status = 'SEALED'");
    expect(capturedSql).toContain("WHERE status IN ('READY', 'LEAD')");
    expect(capturedSql).toContain('created_at < ?');
    expect(capturedSql).toContain('score < ?');

    const expectedCutoff = Math.floor(Date.now() / 1000) - 7 * 86400;
    expect(Math.abs(capturedCutoff - expectedCutoff)).toBeLessThan(5);
  });

  it('upsertCluster preserves SEALED status against overwriting', async () => {
    let capturedSql = '';

    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        capturedSql = sql;
        return {
          bind: vi.fn().mockReturnValue({
            run: async () => ({ success: true }),
          }),
        };
      }),
    } as unknown as D1Database;

    await upsertCluster(mockDb, {
      id: makeClusterId('cluster_sealed_test'),
      label: 'Test Sealed',
      topic_tags: '["AI"]',
      score: 80,
      status: 'READY',
      article_count: 5,
      source_count: 2,
    });

    expect(capturedSql).toContain(
      "status = CASE WHEN clusters.status IN ('SAVED', 'WRITTEN', 'DISMISSED', 'SEALED') THEN clusters.status ELSE excluded.status END"
    );
  });

  it('ClusterBuilder seals stale cluster and skips wave if no fresh articles', async () => {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 86400;
    const mockNodes = [{ id: 'entity_rust', name: 'Rust', type: 'technology', weight: 5 }];
    const mockEdges: Array<{ source: string; target: string; weight: number }> = [];
    const executedSqls: string[] = [];
    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        executedSqls.push(sql);
        const stmt = {
          all: async () => {
            if (sql.includes('FROM entities')) {
              return { results: mockNodes };
            }
            if (sql.includes('FROM edges') || sql.includes('FROM entity_cooccurrences')) {
              return { results: mockEdges };
            }
            if (sql.includes('FROM article_entities')) {
              // Legacy article from 30 days ago
              return {
                results: [
                  {
                    id: 'art_old',
                    source: 'hackernews',
                    url: 'https://news.ycombinator.com/item?id=1',
                    published_at: thirtyDaysAgo,
                    crawled_at: thirtyDaysAgo,
                    evidence: null,
                  },
                ],
              };
            }
            return { results: [] };
          },
          first: async () => {
            if (sql.includes('SELECT created_at, status FROM clusters')) {
              return { created_at: thirtyDaysAgo, status: 'READY' as CardStatus };
            }
            return null;
          },
          run: async () => ({ success: true }),
          bind: vi.fn().mockImplementation((..._params: unknown[]) => stmt),
        };
        return stmt;
      }),
    } as unknown as D1Database;

    const builder = new ClusterBuilder();
    const summary = await builder.buildClustersFromGraph(mockDb);

    // Old cluster was sealed via UPDATE
    expect(executedSqls.some((sql) => sql.includes("UPDATE clusters SET status = 'SEALED'"))).toBe(true);
    // Since there are no fresh articles, clustersUpserted is 0 (no ghost bumping!)
    expect(summary.clustersUpserted).toBe(0);
  });

  it('ClusterBuilder spawns new wave cluster when fresh articles arrive for a sealed topic', async () => {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 86400;
    const freshTime = now - 3600; // 1 hour ago

    const mockNodes = [
      { id: 'entity_cuda', name: 'CUDA', type: 'technology', weight: 5 },
    ];
    const mockEdges: Array<{ source: string; target: string; weight: number }> = [];

    const upsertedClusters: any[] = [];
    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        const stmt = {
          all: async () => {
            if (sql.includes('FROM entities')) {
              return { results: mockNodes };
            }
            if (sql.includes('FROM edges') || sql.includes('FROM entity_cooccurrences')) {
              return { results: mockEdges };
            }
            if (sql.includes('FROM article_entities')) {
              return {
                results: [
                  {
                    id: 'art_old',
                    source: 'hackernews',
                    url: 'https://news.ycombinator.com/item?id=1',
                    published_at: thirtyDaysAgo,
                    crawled_at: thirtyDaysAgo,
                    evidence: null,
                  },
                  {
                    id: 'art_new',
                    source: 'github',
                    url: 'https://github.com/fresh/cuda',
                    published_at: freshTime,
                    crawled_at: freshTime,
                    evidence: null,
                  },
                ],
              };
            }
            return { results: [] };
          },
          first: async () => {
            if (sql.includes('SELECT created_at, status FROM clusters')) {
              return { created_at: thirtyDaysAgo, status: 'SEALED' as CardStatus };
            }
            return null;
          },
          run: async () => ({ success: true }),
          bind: vi.fn().mockImplementation((...params: unknown[]) => {
            if (sql.includes('INSERT INTO clusters')) {
              upsertedClusters.push({ id: params[0], label: params[1], score: params[3], status: params[4] });
            }
            return stmt;
          }),
        };
        return stmt;
      }),
    } as unknown as D1Database;

    const builder = new ClusterBuilder();
    const summary = await builder.buildClustersFromGraph(mockDb);

    expect(summary.clustersUpserted).toBe(1);
    expect(upsertedClusters.length).toBe(1);
    // The newly upserted cluster must have a wave suffix and NOT overwrite the base cluster ID
    const waveEpoch = Math.floor(now / SEAL_WINDOW_SECONDS);
    expect(upsertedClusters[0].id).toContain(`w${waveEpoch}`);
    expect(upsertedClusters[0].status).not.toBe('SEALED');
  });
});
