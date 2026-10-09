import { describe, expect, it, vi } from 'vitest';
import { queryCards } from '../src/lib/db/cluster-queries';
import { SourceType } from '../src/lib/db/types';
import { ScoringEngine } from '../src/lib/scoring/scoring-engine';
import { cardsApp } from '../src/workers/cards-routes';
import { WorkerEnv } from '../src/workers/pipeline';

describe('Ranking Freshness & Temporal Scoring Engine', () => {
  const engine = new ScoringEngine();
  const fixedNow = 1710000000;

  it('keeps full score within 3-day grace period (0d and 3d)', () => {
    const baseInput = {
      sources: ['x', 'hn'] as SourceType[],
      sourceWeights: [1.0, 0.75],
      evidenceCount: 3,
      claimCount: 2,
      totalEngagement: 200,
      publishedAtTimestamps: [fixedNow - 3600],
    };

    const score0d = engine.computeScore({ ...baseInput, clusterCreatedAt: fixedNow }, fixedNow);
    const score3d = engine.computeScore(
      { ...baseInput, clusterCreatedAt: fixedNow - 3 * 86400 },
      fixedNow
    );

    expect(score0d.finalScore).toBe(score3d.finalScore);
    expect(score0d.finalScore).toBeGreaterThan(50);
  });

  it('decays score accurately according to exponential curve at 13d and 33d', () => {
    const input = {
      sources: ['x', 'hn'] as SourceType[],
      sourceWeights: [1.0, 0.75],
      evidenceCount: 4,
      claimCount: 2,
      totalEngagement: 300,
      publishedAtTimestamps: [fixedNow - 3600],
      clusterCreatedAt: fixedNow,
    };

    const freshScore = engine.computeScore(input, fixedNow).finalScore;
    const score13d = engine.computeScore(
      { ...input, clusterCreatedAt: fixedNow - 13 * 86400 },
      fixedNow
    ).finalScore;
    const score33d = engine.computeScore(
      { ...input, clusterCreatedAt: fixedNow - 33 * 86400 },
      fixedNow
    ).finalScore;

    // At 13d (3d grace + 10d), multiplier ≈ exp(-1) ≈ 0.368
    expect(score13d).toBeCloseTo(Math.round(freshScore * Math.exp(-1)), -1);
    // At 33d (3d grace + 30d), multiplier ≈ exp(-3) ≈ 0.050
    expect(score33d).toBeCloseTo(Math.round(freshScore * Math.exp(-3)), -1);
    expect(score33d).toBeLessThan(15);
  });

  it('guarantees fresh topic outranks high-metric 30-day topic in default score sort', () => {
    const oldDominantTopic = {
      sources: ['x', 'hn', 'reddit'] as SourceType[],
      sourceWeights: [1.0, 0.75, 0.4],
      evidenceCount: 15,
      claimCount: 10,
      totalEngagement: 1000,
      publishedAtTimestamps: [fixedNow - 600], // pinged 10m ago
      clusterCreatedAt: fixedNow - 30 * 86400, // 30 days old
    };

    const freshTopic = {
      sources: ['hn', 'reddit'] as SourceType[],
      sourceWeights: [0.75, 0.4],
      evidenceCount: 3,
      claimCount: 2,
      totalEngagement: 80,
      publishedAtTimestamps: [fixedNow - 3600],
      clusterCreatedAt: fixedNow - 2 * 3600, // 2 hours old
    };

    const oldScore = engine.computeScore(oldDominantTopic, fixedNow);
    const freshScore = engine.computeScore(freshTopic, fixedNow);

    expect(freshScore.finalScore).toBeGreaterThan(oldScore.finalScore);
    expect(oldScore.finalScore).toBeLessThan(25);
    expect(freshScore.finalScore).toBeGreaterThan(40);
  });

  it('handles missing or future clusterCreatedAt gracefully', () => {
    const inputMissing = {
      sources: ['x'] as SourceType[],
      evidenceCount: 2,
      claimCount: 2,
      totalEngagement: 100,
      publishedAtTimestamps: [fixedNow - 3600],
    };
    const scoreMissing = engine.computeScore(inputMissing, fixedNow);
    expect(scoreMissing.finalScore).toBeGreaterThan(0);

    const inputFuture = {
      ...inputMissing,
      clusterCreatedAt: fixedNow + 86400, // in future
    };
    const scoreFuture = engine.computeScore(inputFuture, fixedNow);
    expect(scoreFuture.finalScore).toBe(scoreMissing.finalScore);
  });
});

describe('Newest Emergence Sort Contract (Database & API)', () => {
  it('ensures newer cluster outranks older cluster despite new article ping in queryCards', async () => {
    const oldCluster = {
      id: 'clu_old',
      label: 'Old Topic with recent ping',
      topic_tags: '["AI"]',
      score: 12,
      status: 'READY',
      article_count: 5,
      source_count: 2,
      created_at: 1700000000, // 30 days ago
      updated_at: 1702500000,
    };
    const newCluster = {
      id: 'clu_new',
      label: 'Brand New Topic',
      topic_tags: '["AI"]',
      score: 55,
      status: 'READY',
      article_count: 2,
      source_count: 2,
      created_at: 1702590000, // 1 hour ago
      updated_at: 1702590000,
    };

    let clusterSql = '';
    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM clusters')) {
          clusterSql = sql;
        }
        return {
          bind: vi.fn().mockReturnValue({
            all: async () => {
              if (sql.includes('FROM clusters')) {
                // Return clusters ordered by created_at DESC as SQL ORDER BY dictates
                return { results: [newCluster, oldCluster] };
              }
              return { results: [] };
            },
          }),
        };
      }),
    } as unknown as D1Database;

    const cards = await queryCards(mockDb, { sort: 'newest' });

    expect(clusterSql).toContain('ORDER BY c.created_at DESC, c.updated_at DESC');
    expect(cards.length).toBe(2);
    expect(cards[0].id).toBe('clu_new');
    expect(cards[1].id).toBe('clu_old');
  });

  it('sorts guest preview cards by created_at DESC when sort=newest', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        first: async () => ({
          data: JSON.stringify([
            { id: 'c_old', label: 'Old', score: 90, created_at: 100, topic_tags: ['AI'], status: 'READY', sources: [] },
            { id: 'c_new', label: 'New', score: 50, created_at: 900, topic_tags: ['AI'], status: 'READY', sources: [] },
          ]),
          sync_date: '2026-10-09',
        }),
      }),
    } as unknown as D1Database;

    const env: WorkerEnv = { DB: mockDb };
    const req = new Request('http://localhost/?sort=newest', { method: 'GET' });
    const res = await cardsApp.fetch(req, env);

    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; cards: Array<{ id: string; created_at: number }> };
    expect(data.success).toBe(true);
    expect(data.cards.length).toBe(2);
    expect(data.cards[0].id).toBe('c_new');
    expect(data.cards[1].id).toBe('c_old');
  });
});
