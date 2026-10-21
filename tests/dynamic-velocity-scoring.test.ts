import { describe, expect, it, vi } from 'vitest';
import { queryCards } from '../src/lib/db/cluster-queries';
import { ScoringEngine } from '../src/lib/scoring/scoring-engine';

describe('Dynamic Velocity Scoring On-Read (Phase 02)', () => {
  const engine = new ScoringEngine();
  const fixedNow = 1792570000; // e.g. current simulated timestamp

  it('boosts fresh active topics with 24h and 48h velocity multipliers', () => {
    const baseScore = 60;
    const createdAt = fixedNow - 3600; // 1 hour ago (0 days old)

    // Activity 12h ago (<= 24h -> x1.15)
    const score24h = engine.computeDynamicVelocityScore(baseScore, createdAt, fixedNow - 12 * 3600, fixedNow);
    expect(score24h).toBe(Math.round(60 * 1.15)); // 69

    // Activity 36h ago (<= 48h -> x1.08)
    const score48h = engine.computeDynamicVelocityScore(baseScore, createdAt, fixedNow - 36 * 3600, fixedNow);
    expect(score48h).toBe(Math.round(60 * 1.08)); // 65

    // Activity 72h ago (> 48h -> x1.0)
    const scoreOldActivity = engine.computeDynamicVelocityScore(baseScore, createdAt, fixedNow - 72 * 3600, fixedNow);
    expect(scoreOldActivity).toBe(60);
  });

  it('proves a fresh topic (base 55) decisively outranks a 35-day stale topic (base 80)', () => {
    // Fresh topic created 6 hours ago with active discussions 2 hours ago
    const freshCreatedAt = fixedNow - 6 * 3600;
    const freshActivityAt = fixedNow - 2 * 3600;
    const freshDynamic = engine.computeDynamicVelocityScore(55, freshCreatedAt, freshActivityAt, fixedNow);

    // Stale topic created 35 days ago (no activity in 30 days)
    const staleCreatedAt = fixedNow - 35 * 86400;
    const staleActivityAt = fixedNow - 30 * 86400;
    const staleDynamic = engine.computeDynamicVelocityScore(80, staleCreatedAt, staleActivityAt, fixedNow);

    expect(freshDynamic).toBeGreaterThan(60); // 55 * 1.15 = 63
    expect(staleDynamic).toBeLessThan(10); // Exp decay makes it 0-1
    expect(freshDynamic).toBeGreaterThan(staleDynamic * 6);
  });

  it('queryCards re-ranks returned cards by dynamic score on-read', async () => {
    // Cluster A: Stale 35 days ago, static D1 score was 85
    const clusterA = {
      id: 'cluster_stale_cuda',
      label: 'Rust · cuda (Old)',
      topic_tags: JSON.stringify(['AI']),
      score: 85,
      status: 'READY',
      article_count: 10,
      source_count: 3,
      created_at: fixedNow - 35 * 86400,
      updated_at: fixedNow - 35 * 86400,
    };

    // Cluster B: Fresh 12 hours ago, static D1 score was 58
    const clusterB = {
      id: 'cluster_fresh_cloudflare',
      label: 'Cloudflare AI Search (New)',
      topic_tags: JSON.stringify(['AI']),
      score: 58,
      status: 'READY',
      article_count: 2,
      source_count: 2,
      created_at: fixedNow - 12 * 3600,
      updated_at: fixedNow - 2 * 3600,
    };

    const mockArticlesA = [
      {
        id: 'art_a',
        title: 'Old Rust post',
        url: 'https://example.com/a',
        source: 'hn',
        author: 'someone',
        published_at: fixedNow - 35 * 86400,
        crawled_at: fixedNow - 35 * 86400,
        summary: 'Old summary',
        evidence: null,
        counter: null,
        context: null,
        verification_questions: null,
      },
    ];

    const mockArticlesB = [
      {
        id: 'art_b',
        title: 'Cloudflare AI Search Announced',
        url: 'https://blog.cloudflare.com/ai-search',
        source: 'cloudflare',
        author: 'cf_team',
        published_at: fixedNow - 2 * 3600,
        crawled_at: fixedNow - 2 * 3600,
        summary: 'Cloudflare announces native vector search',
        evidence: JSON.stringify(['Sub-10ms latency']),
        counter: null,
        context: null,
        verification_questions: null,
      },
    ];

    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        const stmt = {
          all: async () => {
            if (sql.includes('FROM clusters')) {
              // Return ordered by static score as SQL initially does: [A (85), B (58)]
              return { results: [clusterA, clusterB] };
            }
            return { results: [] };
          },
          bind: vi.fn().mockImplementation((...params: unknown[]) => {
            return {
              all: async () => {
                if (sql.includes('FROM clusters')) {
                  return { results: [clusterA, clusterB] };
                }
                if (sql.includes('FROM cluster_articles')) {
                  const clusterId = params[0];
                  if (clusterId === 'cluster_stale_cuda') {
                    return { results: mockArticlesA };
                  }
                  if (clusterId === 'cluster_fresh_cloudflare') {
                    return { results: mockArticlesB };
                  }
                }
                return { results: [] };
              },
            };
          }),
        };
        return stmt;
      }),
    } as unknown as D1Database;

    const cards = await queryCards(mockDb, { nowSeconds: fixedNow });

    expect(cards.length).toBe(2);
    // Even though Cluster A had static score 85 and B had 58 in D1,
    // on-read dynamic velocity scoring puts Cluster B (fresh) at the top!
    expect(cards[0].id).toBe('cluster_fresh_cloudflare');
    expect(cards[0].score).toBeGreaterThan(65);
    expect(cards[1].id).toBe('cluster_stale_cuda');
    expect(cards[1].score).toBeLessThan(10);
  });
});
