import { describe, expect, it, vi } from 'vitest';
import { executeScheduledCrawl, WorkerEnv } from '../src/workers/pipeline';
import { CrawlerRegistry } from '../src/lib/sources/crawler-registry';
import * as articleQueries from '../src/lib/db/article-queries';
import { makeArticleId } from '../src/lib/db/types';

describe('executeScheduledCrawl Queue & Local Dev Fallback', () => {
  it('enqueues inserted articles when ARTICLE_QUEUE is present', async () => {
    const sentMessages: Array<{ articleId: string }> = [];
    const mockQueue = {
      send: vi.fn(async (msg: { articleId: string }) => {
        sentMessages.push(msg);
      }),
    } as unknown as Queue;

    vi.spyOn(CrawlerRegistry.prototype, 'runAll').mockResolvedValueOnce({
      crawlersRun: ['rss', 'hn'],
      totalFetched: 5,
      duplicateCount: 0,
      insertedArticleIds: [
        makeArticleId('art_1'),
        makeArticleId('art_2'),
        makeArticleId('art_3'),
        makeArticleId('art_4'),
        makeArticleId('art_5'),
      ],
      errors: [],
    });

    const env: WorkerEnv = {
      DB: {} as D1Database,
      ARTICLE_QUEUE: mockQueue,
    };

    await executeScheduledCrawl(env);

    expect(mockQueue.send).toHaveBeenCalledTimes(5);
    expect(sentMessages).toEqual([
      { articleId: 'art_1' },
      { articleId: 'art_2' },
      { articleId: 'art_3' },
      { articleId: 'art_4' },
      { articleId: 'art_5' },
    ]);
  });

  it('falls back to synchronous processing when ARTICLE_QUEUE is missing (local dev)', async () => {
    vi.spyOn(CrawlerRegistry.prototype, 'runAll').mockResolvedValueOnce({
      crawlersRun: ['rss'],
      totalFetched: 3,
      duplicateCount: 1,
      insertedArticleIds: [makeArticleId('art_1')],
      errors: [],
    });

    const getUnprocessedSpy = vi.spyOn(articleQueries, 'getUnprocessedArticles').mockResolvedValueOnce([
      {
        id: makeArticleId('art_unprocessed_1'),
        source: 'reddit',
        source_id: 'sub_1',
        url: 'https://example.com/1',
        title: 'Title 1',
        body: 'Body 1',
        author: 'author1',
        published_at: 123456789,
        crawled_at: 123456789,
        processed: 0,
      },
    ]);

    // Mock ArticleExtractor to prevent external API calls
    const { ArticleExtractor } = await import('../src/lib/llm/extractor');
    vi.spyOn(ArticleExtractor.prototype, 'extract').mockResolvedValueOnce({
      summary: 'Test summary',
      evidence: ['evidence 1'],
      counter: ['counter 1'],
      context: ['context 1'],
      verification_questions: ['q1'],
      entities: [{ name: 'TestEntity', type: 'technology' }],
      topic_tags: ['AI'],
    });

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
      }),
    } as unknown as D1Database;

    const env: WorkerEnv = {
      DB: mockDb,
      GEMINI_API_KEY: 'test-key',
    };

    // Should query getUnprocessedArticles with remaining quota (5 - 1 = 4)
    await executeScheduledCrawl(env);

    expect(getUnprocessedSpy).toHaveBeenCalledWith(mockDb, 4);
  });
});
