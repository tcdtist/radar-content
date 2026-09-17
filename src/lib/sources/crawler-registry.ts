import { checkUrlExists, insertArticle } from '../db/article-queries';
import { ArticleId } from '../db/types';
import { HackerNewsCrawler } from './hn-crawler';
import { LobstersCrawler } from './lobsters-crawler';
import { RedditCrawler } from './reddit-crawler';
import { RssCrawler } from './rss-crawler';
import { RawSourcePost, SourceCrawler } from './source-types';

export interface CrawlExecutionSummary {
  crawlersRun: string[];
  totalFetched: number;
  duplicateCount: number;
  insertedArticleIds: ArticleId[];
  errors: string[];
}

export class CrawlerRegistry {
  private crawlers: SourceCrawler[] = [];

  constructor() {
    this.register(new RssCrawler());
    this.register(new HackerNewsCrawler());
    this.register(new LobstersCrawler());
    this.register(new RedditCrawler());
  }

  register(crawler: SourceCrawler): void {
    this.crawlers.push(crawler);
  }

  getCrawlers(): readonly SourceCrawler[] {
    return this.crawlers;
  }

  async runAll(db: D1Database, limitPerCrawler = 15): Promise<CrawlExecutionSummary> {
    const summary: CrawlExecutionSummary = {
      crawlersRun: [],
      totalFetched: 0,
      duplicateCount: 0,
      insertedArticleIds: [],
      errors: [],
    };

    const allPosts: RawSourcePost[] = [];

    for (const crawler of this.crawlers) {
      try {
        summary.crawlersRun.push(crawler.name);
        const posts = await crawler.fetchLatest(limitPerCrawler);
        allPosts.push(...posts);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        summary.errors.push(`${crawler.name}: ${message}`);
      }
    }

    summary.totalFetched = allPosts.length;

    for (const post of allPosts) {
      try {
        const exists = await checkUrlExists(db, post.url);
        if (exists) {
          summary.duplicateCount++;
          continue;
        }

        const articleId = await insertArticle(db, {
          source: post.source,
          source_id: post.sourceId,
          url: post.url,
          title: post.title,
          body: post.body,
          author: post.author,
          published_at: post.publishedAt,
        });

        if (articleId) {
          summary.insertedArticleIds.push(articleId);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        summary.errors.push(`Insert failed for ${post.url}: ${message}`);
      }
    }

    return summary;
  }
}
