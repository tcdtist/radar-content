import { checkUrlExists, insertArticle } from '../lib/db/article-queries';
import { ArticleId } from '../lib/db/types';
import { RawSourcePost } from '../lib/sources/source-types';
import { processArticlePipeline, WorkerEnv } from './pipeline';

export interface IngestRequestPayload {
  posts: RawSourcePost[];
  processNow?: boolean;
}

export interface IngestResponse {
  success: boolean;
  totalReceived: number;
  duplicateCount: number;
  insertedCount: number;
  insertedArticleIds: ArticleId[];
  insertedUrls: string[];
  processedCount: number;
  errors: string[];
}

/**
 * Check a list of URLs against D1 in batch and return those that already exist.
 */
export async function handleCheckExistingUrls(
  env: WorkerEnv,
  urls: string[]
): Promise<string[]> {
  if (!Array.isArray(urls) || urls.length === 0) return [];
  const existing: string[] = [];
  const batchSize = 50;

  for (let i = 0; i < urls.length; i += batchSize) {
    const chunk = urls.slice(i, i + batchSize);
    const placeholders = chunk.map(() => '?').join(',');
    const stmt = env.DB.prepare(`SELECT url FROM articles WHERE url IN (${placeholders})`);
    const { results } = await stmt.bind(...chunk).all<{ url: string }>();
    if (results) {
      existing.push(...results.map((r) => r.url));
    }
  }

  return existing;
}

/**
 * Ingest an external array of raw source posts into D1 and optionally enqueue/process.
 */
const ALLOWED_MACRO_SOURCES = new Set(['x', 'hn', 'lobsters', 'rss', 'reddit']);

export async function handleIngestPosts(
  env: WorkerEnv,
  payload: IngestRequestPayload
): Promise<IngestResponse> {
  const result: IngestResponse = {
    success: true,
    totalReceived: payload.posts?.length || 0,
    duplicateCount: 0,
    insertedCount: 0,
    insertedArticleIds: [],
    insertedUrls: [],
    processedCount: 0,
    errors: [],
  };

  if (!Array.isArray(payload.posts) || payload.posts.length === 0) {
    return result;
  }

  for (const post of payload.posts) {
    try {
      if (!post.url || !post.title || !post.source) {
        result.errors.push('Invalid post structure: missing url, title, or source');
        continue;
      }

      if (!ALLOWED_MACRO_SOURCES.has(post.source)) {
        result.errors.push(
          `Disallowed source "${post.source}". Radar Content only ingests macro sources (x, hn, lobsters, rss, reddit).`
        );
        continue;
      }

      const exists = await checkUrlExists(env.DB, post.url);
      if (exists) {
        result.duplicateCount++;
        continue;
      }

      const articleId = await insertArticle(env.DB, {
        source: post.source,
        source_id: post.sourceId || post.url,
        url: post.url,
        title: post.title,
        body: post.body,
        author: post.author,
        published_at: post.publishedAt || Math.floor(Date.now() / 1000),
      });

      if (!articleId) {
        result.duplicateCount++;
        continue;
      }

      result.insertedArticleIds.push(articleId);
      result.insertedUrls.push(post.url);
      result.insertedCount++;

      if (env.ARTICLE_QUEUE) {
        try {
          await env.ARTICLE_QUEUE.send({ articleId });
        } catch (queueErr) {
          console.error(`Failed to enqueue article ${articleId}:`, queueErr);
        }
      }

      if (payload.processNow) {
        try {
          const ok = await processArticlePipeline(
            env,
            articleId,
            post.title,
            post.body,
            post.source
          );
          if (ok) result.processedCount++;
        } catch (procErr) {
          result.errors.push(`Processing failed for ${articleId}: ${String(procErr)}`);
        }
      }
    } catch (err) {
      result.errors.push(`Failed to ingest post ${post.url}: ${String(err)}`);
    }
  }

  return result;
}
