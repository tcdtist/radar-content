import { markArticleProcessed } from '../lib/db/article-queries';
import { makeArticleId } from '../lib/db/types';
import { ClusterBuilder } from '../lib/graph/cluster-builder';
import { EntityBuilder } from '../lib/graph/entity-builder';
import { ArticleExtractor } from '../lib/llm/extractor';
import { GeminiClient } from '../lib/llm/gemini-client';
import { insertExtraction } from '../lib/db/extraction-queries';
import { CrawlerRegistry } from '../lib/sources/crawler-registry';

export interface WorkerEnv {
  DB: D1Database;
  ARTICLE_QUEUE?: Queue;
  AI?: any;
  GEMINI_API_KEY?: string;
  GEMINI_TRANSLATION_KEY?: string;
  GEMINI_MODEL?: string;
  CRAWL_SOURCES?: string;
  CRAWL_FREQUENCY?: string;
  TIMEZONE?: string;
  ADMIN_EMAIL?: string;
  ALLOWED_EMAILS?: string;
  ADMIN_SECRET?: string;
  JWT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  RADAR_GITHUB_TOKEN?: string;
  GITHUB_REPOSITORY?: string;
}

export interface QueueMessageBody {
  articleId: string;
  title: string;
  body: string | null;
  source: string;
}

/**
 * Execute cron crawling task.
 */
export async function executeScheduledCrawl(env: WorkerEnv): Promise<void> {
  const registry = new CrawlerRegistry();
  const summary = await registry.runAll(env.DB, 15);
  console.log(`[Crawler] Fetched: ${summary.totalFetched}, Duplicates: ${summary.duplicateCount}, Inserted: ${summary.insertedArticleIds.length}`);

  if (env.ARTICLE_QUEUE && summary.insertedArticleIds.length > 0) {
    for (const id of summary.insertedArticleIds) {
      try {
        await env.ARTICLE_QUEUE.send({ articleId: id });
      } catch (err) {
        console.error(`Failed to enqueue article ${id}:`, err);
      }
    }
  }
}

/**
 * Process a single article through Gemini and update graph.
 */
export async function processArticlePipeline(
  env: WorkerEnv,
  articleIdStr: string,
  title: string,
  body: string | null,
  source: string
): Promise<boolean> {
  const apiKey = env.GEMINI_API_KEY || 'dummy_key';
  const client = new GeminiClient({ apiKey, ...(env.GEMINI_MODEL ? { model: env.GEMINI_MODEL } : {}) });
  const extractor = new ArticleExtractor(client);
  const entityBuilder = new EntityBuilder();

  const articleId = makeArticleId(articleIdStr);

  try {
    // 1. LLM Structured Extraction
    const extraction = await extractor.extract(title, body, source);

    // 2. Persist extraction in D1
    await insertExtraction(env.DB, articleId, extraction);

    // 3. Extract and persist entities, link to article and build graph edges
    await entityBuilder.processArticleEntities(env.DB, extraction.entities, articleId);

    // 4. Mark article as processed
    await markArticleProcessed(env.DB, articleId);

    // 5. Update topic clusters
    const clusterBuilder = new ClusterBuilder();
    await clusterBuilder.buildClustersFromGraph(env.DB);

    return true;
  } catch (err) {
    console.error(`Error processing article ${articleIdStr}:`, err);
    return false;
  }
}
