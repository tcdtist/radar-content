import { describe, expect, it, vi } from 'vitest';
import { queryCards } from '../src/lib/db/cluster-queries';

describe('Cluster Queries (queryCards)', () => {
  it('constructs correct SQL with correlated subquery for sort=newest', async () => {
    let capturedSql = '';
    let capturedParams: unknown[] = [];

    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        capturedSql = sql;
        return {
          bind: vi.fn().mockImplementation((...params: unknown[]) => {
            capturedParams = params;
            return {
              all: async () => ({ results: [] }),
            };
          }),
        };
      }),
    } as unknown as D1Database;

    await queryCards(mockDb, { sort: 'newest', status: 'READY,LEAD', limit: 25, page: 2 });

    expect(capturedSql).toContain('SELECT c.id, c.label, c.topic_tags, c.score, c.status, c.article_count, c.source_count, c.created_at, c.updated_at');
    expect(capturedSql).toContain('FROM clusters c');
    expect(capturedSql).toContain('WHERE c.status IN (?,?)');
    expect(capturedSql).toContain('ORDER BY COALESCE(');
    expect(capturedSql).toContain('SELECT MAX(COALESCE(a.published_at, a.crawled_at, 0))');
    expect(capturedSql).toContain('FROM cluster_articles ca');
    expect(capturedSql).toContain('JOIN articles a ON ca.article_id = a.id');
    expect(capturedSql).toContain('WHERE ca.cluster_id = c.id');
    expect(capturedSql).toContain('c.created_at');
    expect(capturedSql).toContain('DESC');
    expect(capturedParams).toEqual(['READY', 'LEAD', 25, 25]);
  });

  it('constructs correct SQL for default sort=score and sort=evidence', async () => {
    const capturedSqls: string[] = [];

    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        capturedSqls.push(sql);
        return {
          bind: vi.fn().mockReturnValue({
            all: async () => ({ results: [] }),
          }),
        };
      }),
    } as unknown as D1Database;

    // Default / score
    await queryCards(mockDb, {});
    expect(capturedSqls[0]).toContain('ORDER BY c.score DESC');

    // Evidence / article_count
    await queryCards(mockDb, { sort: 'evidence' });
    expect(capturedSqls[1]).toContain('ORDER BY c.article_count DESC');
  });

  it('maps cluster records and linked articles into ScoredIntelligenceCard format', async () => {
    const mockCluster = {
      id: 'cluster_test_1',
      label: 'DeepSeek LLM Architecture',
      topic_tags: JSON.stringify(['AI', 'LLM']),
      score: 92,
      status: 'READY',
      article_count: 2,
      source_count: 2,
      created_at: 1789700000,
      updated_at: 1789710000,
    };

    const mockArticles = [
      {
        id: 'art_1',
        title: 'DeepSeek-V3 Technical Overview',
        url: 'https://news.ycombinator.com/item?id=123',
        source: 'hn',
        author: 'sama',
        published_at: 1789705000,
        crawled_at: 1789705500,
        summary: 'DeepSeek releases new model report.',
        evidence: JSON.stringify(['10x cheaper inference', '88.5% on HumanEval']),
        counter: JSON.stringify(['High initial VRAM']),
        context: JSON.stringify(['Open source frontier AI']),
        verification_questions: JSON.stringify(['Can it run locally?']),
      },
    ];

    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        return {
          bind: vi.fn().mockImplementation((..._params: unknown[]) => {
            return {
              all: async () => {
                if (sql.includes('FROM clusters')) {
                  return { results: [mockCluster] };
                }
                if (sql.includes('FROM cluster_articles')) {
                  return { results: mockArticles };
                }
                return { results: [] };
              },
            };
          }),
        };
      }),
    } as unknown as D1Database;

    const cards = await queryCards(mockDb, { sort: 'newest' });

    expect(cards.length).toBe(1);
    const card = cards[0];
    expect(card.id).toBe('cluster_test_1');
    expect(card.label).toBe('DeepSeek LLM Architecture');
    expect(card.topic_tags).toEqual(['AI', 'LLM']);
    expect(card.score).toBe(92);
    expect(card.status).toBe('READY');
    expect(card.summary).toBe('DeepSeek releases new model report.');
    expect(card.evidence).toContain('10x cheaper inference');
    expect(card.counter).toContain('High initial VRAM');
    expect(card.context).toContain('Open source frontier AI');
    expect(card.verification_questions).toContain('Can it run locally?');
    expect(card.sources.length).toBe(1);
    expect(card.sources[0].title).toBe('DeepSeek-V3 Technical Overview');
  });

  it('filters by topic correctly in application layer', async () => {
    const clusterAI = {
      id: 'c_ai',
      label: 'AI Topic',
      topic_tags: JSON.stringify(['AI']),
      score: 80,
      status: 'READY',
      article_count: 1,
      source_count: 1,
      created_at: 100,
      updated_at: 100,
    };
    const clusterFrontend = {
      id: 'c_fe',
      label: 'Frontend Topic',
      topic_tags: JSON.stringify(['Frontend']),
      score: 75,
      status: 'READY',
      article_count: 1,
      source_count: 1,
      created_at: 100,
      updated_at: 100,
    };

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: async () => ({ results: [clusterAI, clusterFrontend] }),
        }),
      }),
    } as unknown as D1Database;

    const cards = await queryCards(mockDb, { topic: 'frontend' });
    expect(cards.length).toBe(1);
    expect(cards[0].id).toBe('c_fe');
  });
});
