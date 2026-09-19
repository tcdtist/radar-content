import { describe, expect, it, vi } from 'vitest';
import { pruneStaleData } from '../src/lib/db/prune-queries';

describe('Data Retention & Auto-Pruning Queries', () => {
  it('prunes dismissed clusters, stale leads, and unlinked articles while immunizing saved & written', async () => {
    const executedSqls: string[] = [];

    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        executedSqls.push(sql);
        return {
          bind: () => ({
            run: async () => ({
              meta: { changes: sql.includes('clusters') ? 3 : 5 },
            }),
          }),
          run: async () => ({
            meta: { changes: 2 },
          }),
        };
      }),
    } as unknown as D1Database;

    const fixedNow = 1789720000;
    const stats = await pruneStaleData(mockDb, fixedNow);

    expect(stats.prunedClusters).toBeGreaterThan(0);
    expect(stats.prunedArticles).toBeGreaterThan(0);

    // Verify absolute immunity: No query deletes SAVED or WRITTEN
    for (const sql of executedSqls) {
      expect(sql).not.toContain("'SAVED'");
      expect(sql).not.toContain("'WRITTEN'");
      if (sql.includes('DELETE FROM clusters')) {
        expect(sql).toMatch(/status = 'DISMISSED'|status = 'LEAD'/);
      }
    }
  });

  it('handles database errors gracefully without throwing', async () => {
    const brokenDb = {
      prepare: vi.fn().mockImplementation(() => {
        throw new Error('D1 Connection Failed');
      }),
    } as unknown as D1Database;

    const stats = await pruneStaleData(brokenDb);
    expect(stats.prunedClusters).toBe(0);
    expect(stats.prunedArticles).toBe(0);
  });
});
