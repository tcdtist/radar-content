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
  processedCount: number;
  errors: string[];
}

/**
 * Ingest an external array of raw source posts into D1 and optionally enqueue/process.
 */
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
