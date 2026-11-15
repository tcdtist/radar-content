import { describe, expect, it, vi } from 'vitest';
import { queryCardById } from '../src/lib/db/card-detail-queries';
import { queryCards } from '../src/lib/db/cluster-queries';
import { insertExtraction } from '../src/lib/db/extraction-queries';
import { handleIngestPosts } from '../src/workers/ingest-handler';
import { processArticlePipeline, WorkerEnv } from '../src/workers/pipeline';
import { makeArticleId, makeClusterId } from '../src/lib/db/types';
import { consolidateDuplicateClusters, normalizeClusterLabelKey } from '../src/lib/graph/cluster-builder-utils';
import { MOCK_INTELLIGENCE_CARDS } from '../src/lib/data/mock-cards';

describe('Source Duplication & Pipeline Idempotency Regression Tests', () => {
  describe('Query Layer: queryCardById & queryCards Source Deduplication', () => {
    it('ensures queryCardById deduplicates sources when articles have multiple extraction records', async () => {
      // Recreate database scenario:
      // Cluster has 2 articles, but art_1 has 2 extraction rows and art_2 has 2 extraction rows (4 rows returned by raw join)
      const mockDb = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM clusters')) {
            return {
              bind: vi.fn().mockReturnValue({
                first: async () => ({
                  id: 'cluster_test_dedup',
                  label: 'Anthropic · claude code',
                  topic_tags: JSON.stringify(['AI']),
                  score: 85,
                  status: 'READY',
                  article_count: 2,
                  source_count: 1,
                  created_at: 1790000000,
                  updated_at: 1790001000,
                }),
              }),
            };
          }

          if (sql.includes('FROM cluster_articles')) {
            return {
              bind: vi.fn().mockReturnValue({
                all: async () => ({
                  results: [
                    {
                      id: 'art_1',
                      title: 'Grok Bot worked hard overnight',
                      url: 'https://x.com/user/1',
                      source: 'x',
                      author: '@user1',
                      published_at: 1790000000,
                      crawled_at: 1790000005,
                      summary: 'Summary 1',
                      evidence: JSON.stringify(['Ev 1']),
                      counter: null,
                      context: null,
                      verification_questions: null,
                    },
                    // Raw join without fix would return duplicate art_1 for second extraction:
                    {
                      id: 'art_1',
                      title: 'Grok Bot worked hard overnight',
                      url: 'https://x.com/user/1',
                      source: 'x',
                      author: '@user1',
                      published_at: 1790000000,
                      crawled_at: 1790000005,
                      summary: 'Summary 1 duplicate',
                      evidence: JSON.stringify(['Ev 1']),
                      counter: null,
                      context: null,
                      verification_questions: null,
                    },
                    {
                      id: 'art_2',
                      title: 'Make a Claude Code mod',
                      url: 'https://x.com/user/2',
                      source: 'x',
                      author: '@user2',
                      published_at: 1789999000,
                      crawled_at: 1790000005,
                      summary: 'Summary 2',
                      evidence: JSON.stringify(['Ev 2']),
                      counter: null,
                      context: null,
                      verification_questions: null,
                    },
                  ],
                }),
              }),
            };
          }

          return { bind: vi.fn().mockReturnValue({ first: async () => null, all: async () => ({ results: [] }) }) };
        }),
      } as unknown as D1Database;

      const card = await queryCardById(mockDb, makeClusterId('cluster_test_dedup'));
      expect(card).not.toBeNull();
      // Must deduplicate to exactly 2 sources
      expect(card?.sources.length).toBe(2);
      expect(card?.sources[0].url).toBe('https://x.com/user/1');
      expect(card?.sources[1].url).toBe('https://x.com/user/2');
    });

    it('ensures queryCards deduplicates sources across scored intelligence cards', async () => {
      const mockDb = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM clusters')) {
            return {
              bind: vi.fn().mockReturnValue({
                all: async () => ({
                  results: [
                    {
                      id: 'cluster_1',
                      label: 'Test Cluster',
                      topic_tags: JSON.stringify(['AI']),
                      score: 80,
                      status: 'READY',
                      article_count: 2,
                      source_count: 1,
                      created_at: 1790000000,
                      updated_at: 1790001000,
                    },
                  ],
                }),
              }),
            };
          }

          if (sql.includes('FROM cluster_articles')) {
            return {
              bind: vi.fn().mockReturnValue({
                all: async () => ({
                  results: [
                    {
                      id: 'art_1',
                      title: 'Article 1',
                      url: 'https://x.com/user/1',
                      source: 'x',
                      author: '@user1',
                      published_at: 1790000000,
                      crawled_at: 1790000005,
                      summary: 'Summary 1',
                    },
                    {
                      id: 'art_1', // Duplicate row
                      title: 'Article 1',
                      url: 'https://x.com/user/1',
                      source: 'x',
                      author: '@user1',
                      published_at: 1790000000,
                      crawled_at: 1790000005,
                      summary: 'Summary 1',
                    },
                  ],
                }),
              }),
            };
          }

          return { bind: vi.fn().mockReturnValue({ all: async () => ({ results: [] }) }) };
        }),
      } as unknown as D1Database;

      const cards = await queryCards(mockDb, { status: 'READY' });
      expect(cards.length).toBe(1);
      expect(cards[0].sources.length).toBe(1);
      expect(cards[0].sources[0].url).toBe('https://x.com/user/1');
    });
  });

  describe('Ingest Layer: Mutual Exclusion between processNow and Queue', () => {
    it('does NOT enqueue to ARTICLE_QUEUE when processNow is true', async () => {
      const mockQueueSend = vi.fn().mockResolvedValue(undefined);
      const mockDb = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('SELECT processed FROM articles')) {
            return {
              bind: vi.fn().mockReturnValue({
                first: async () => ({ processed: 1 }),
              }),
            };
          }
          return {
            bind: vi.fn().mockReturnValue({
              first: async () => null, // checkUrlExists returns null (new post)
              run: async () => ({ success: true, meta: { changes: 1 } }), // insertArticle returns success
            }),
          };
        }),
      } as unknown as D1Database;

      const env: WorkerEnv = {
        DB: mockDb,
        ARTICLE_QUEUE: { send: mockQueueSend } as unknown as Queue,
        GEMINI_API_KEY: 'test-key',
      };

      const result = await handleIngestPosts(env, {
        posts: [
          {
            source: 'x',
            sourceId: '1',
            url: 'https://x.com/test/1',
            title: 'Test Post',
            body: 'Test Body',
            author: '@author',
            publishedAt: 1790000000,
            engagementScore: 10,
            commentsCount: 2,
          },
        ],
        processNow: true,
      });

      expect(result.insertedCount).toBe(1);
      // Crucial: mockQueueSend must NOT be called when processNow is true!
      expect(mockQueueSend).not.toHaveBeenCalled();
    });

    it('enqueues to ARTICLE_QUEUE when processNow is false or undefined', async () => {
      const mockQueueSend = vi.fn().mockResolvedValue(undefined);
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: async () => null,
            run: async () => ({ success: true, meta: { changes: 1 } }),
          }),
        }),
      } as unknown as D1Database;

      const env: WorkerEnv = {
        DB: mockDb,
        ARTICLE_QUEUE: { send: mockQueueSend } as unknown as Queue,
      };

      const result = await handleIngestPosts(env, {
        posts: [
          {
            source: 'x',
            sourceId: '2',
            url: 'https://x.com/test/2',
            title: 'Test Post 2',
            body: 'Test Body 2',
            author: '@author',
            publishedAt: 1790000000,
            engagementScore: 10,
            commentsCount: 2,
          },
        ],
        processNow: false,
      });

      expect(result.insertedCount).toBe(1);
      expect(mockQueueSend).toHaveBeenCalledTimes(1);
      expect(mockQueueSend).toHaveBeenCalledWith(expect.objectContaining({ articleId: expect.any(String) }));
    });
  });

  describe('Pipeline & Extraction Idempotency', () => {
    it('skips LLM extraction when article is already processed', async () => {
      const mockDb = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('SELECT processed FROM articles')) {
            return {
              bind: vi.fn().mockReturnValue({
                first: async () => ({ processed: 1 }), // Already processed
              }),
            };
          }
          return { bind: vi.fn().mockReturnValue({ first: async () => null, run: async () => ({ success: true }) }) };
        }),
      } as unknown as D1Database;

      const env: WorkerEnv = {
        DB: mockDb,
        GEMINI_API_KEY: 'mock-key',
      };

      const ok = await processArticlePipeline(env, 'art_already_processed', 'Title', 'Body', 'x');
      expect(ok).toBe(true);
      // DB was only queried for processed check, no extraction was inserted
    });

    it('insertExtraction returns existing ID and does not duplicate if extraction exists', async () => {
      let insertExecuted = false;
      const mockDb = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('SELECT id, article_id')) {
            return {
              bind: vi.fn().mockReturnValue({
                first: async () => ({
                  id: 'ext_existing_123',
                  article_id: 'art_123',
                  summary: 'Existing summary',
                  evidence: '[]',
                  counter: '[]',
                  context: '[]',
                  verification_questions: '[]',
                  extracted_at: 1790000000,
                }),
              }),
            };
          }
          if (sql.includes('INSERT INTO extractions')) {
            insertExecuted = true;
            return { bind: vi.fn().mockReturnValue({ run: async () => ({ success: true }) }) };
          }
          return { bind: vi.fn().mockReturnValue({ first: async () => null, run: async () => ({ success: true }) }) };
        }),
      } as unknown as D1Database;

      const id = await insertExtraction(mockDb, makeArticleId('art_123'), {
        summary: 'New summary',
        topic_tags: ['AI'],
        entities: [],
        evidence: [],
        counter: [],
        context: [],
        verification_questions: [],
      });

      expect(id).toBe('ext_existing_123');
      expect(insertExecuted).toBe(false);
    });
  });

  describe('Cluster & Card Deduplication (Anagram Labels & Cross-Bucket Partitions)', () => {
    it('normalizeClusterLabelKey produces identical keys for anagram/permuted entity labels', () => {
      const key1 = normalizeClusterLabelKey('Rust · python, jaana dogan');
      const key2 = normalizeClusterLabelKey('Rust · jaana dogan, python');
      const key3 = normalizeClusterLabelKey('Python · rust, jaana dogan');

      expect(key1).toBe('jaana dogan|python|rust');
      expect(key2).toBe('jaana dogan|python|rust');
      expect(key3).toBe('jaana dogan|python|rust');
      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });

    it('consolidateDuplicateClusters consolidates anagram cluster rows', async () => {
      let deletedClusters: string[] = [];
      const mockDb = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('SELECT id, label FROM clusters')) {
            return {
              bind: vi.fn().mockReturnValue({
                all: async () => ({
                  results: [
                    { id: 'cluster_xwi4s8', label: 'Rust · jaana dogan, python' },
                    { id: 'cluster_different', label: 'Vercel · Next.js' },
                  ],
                }),
              }),
            };
          }
          if (sql.includes('DELETE FROM clusters WHERE id = ?')) {
            return {
              bind: vi.fn().mockImplementation((id: string) => {
                deletedClusters.push(id);
                return { run: async () => ({ success: true }) };
              }),
            };
          }
          return {
            bind: vi.fn().mockReturnValue({
              run: async () => ({ success: true }),
              first: async () => null,
            }),
          };
        }),
      } as unknown as D1Database;

      await consolidateDuplicateClusters(
        mockDb,
        'Rust · python, jaana dogan',
        makeClusterId('cluster_qlv5fa')
      );

      expect(deletedClusters).toContain('cluster_xwi4s8');
      expect(deletedClusters).not.toContain('cluster_different');
    });

    it('queryCards skips clusters with duplicate or anagram entity labels', async () => {
      const mockDb = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM clusters c')) {
            return {
              bind: vi.fn().mockReturnValue({
                all: async () => ({
                  results: [
                    {
                      id: 'cluster_1',
                      label: 'Rust · python, jaana dogan',
                      topic_tags: JSON.stringify(['AI']),
                      score: 90,
                      status: 'READY',
                      article_count: 5,
                      source_count: 2,
                      created_at: 1790000000,
                      updated_at: 1790001000,
                    },
                    {
                      id: 'cluster_2',
                      label: 'Rust · jaana dogan, python', // Anagram of cluster_1
                      topic_tags: JSON.stringify(['AI']),
                      score: 85,
                      status: 'READY',
                      article_count: 5,
                      source_count: 2,
                      created_at: 1790000000,
                      updated_at: 1790001000,
                    },
                    {
                      id: 'cluster_3',
                      label: 'Qwen · latent space, deepseek',
                      topic_tags: JSON.stringify(['AI']),
                      score: 80,
                      status: 'READY',
                      article_count: 3,
                      source_count: 1,
                      created_at: 1790000000,
                      updated_at: 1790001000,
                    },
                  ],
                }),
              }),
            };
          }
          if (sql.includes('FROM cluster_articles ca')) {
            return {
              bind: vi.fn().mockReturnValue({
                all: async () => ({
                  results: [
                    {
                      id: 'art_10',
                      title: 'Article 10',
                      url: 'https://example.com/10',
                      source: 'hn',
                      author: 'author1',
                      published_at: 1790000000,
                      crawled_at: 1790000005,
                      summary: 'Summary 10',
                      evidence: '[]',
                      counter: '[]',
                      context: '[]',
                      verification_questions: '[]',
                    },
                  ],
                }),
              }),
            };
          }
          return { bind: vi.fn().mockReturnValue({ first: async () => null, all: async () => ({ results: [] }) }) };
        }),
      } as unknown as D1Database;

      const cards = await queryCards(mockDb, { status: 'READY' });
      expect(cards.length).toBe(2);
      expect(cards.map((c) => c.id)).toEqual(['cluster_1', 'cluster_3']);
    });

    it('MOCK_INTELLIGENCE_CARDS contains zero duplicate IDs and zero duplicate labels', () => {
      expect(MOCK_INTELLIGENCE_CARDS.length).toBeGreaterThan(0);

      const seenIds = new Set<string>();
      const seenLabels = new Set<string>();

      for (const card of MOCK_INTELLIGENCE_CARDS) {
        expect(seenIds.has(card.id)).toBe(false);
        seenIds.add(card.id);

        const key = normalizeClusterLabelKey(card.label);
        expect(seenLabels.has(key)).toBe(false);
        seenLabels.add(key);
      }
    });
  });
});
