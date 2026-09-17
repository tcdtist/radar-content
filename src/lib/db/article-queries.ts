import { ArticleId, ArticleRecord, makeArticleId, SourceType } from './types';

export interface NewArticleInput {
  source: SourceType;
  source_id: string;
  url: string;
  title: string;
  body: string | null;
  author: string | null;
  published_at: number | null;
}

/**
 * Check if an article with the given URL already exists in D1.
 */
export async function checkUrlExists(db: D1Database, url: string): Promise<boolean> {
  const statement = db.prepare('SELECT id FROM articles WHERE url = ? LIMIT 1');
  const result = await statement.bind(url).first<{ id: string }>();
  return result !== null;
}

/**
 * Insert a new raw article into D1.
 */
export async function insertArticle(
  db: D1Database,
  input: NewArticleInput
): Promise<ArticleId | null> {
  const id = makeArticleId(`art_${crypto.randomUUID()}`);
  const now = Math.floor(Date.now() / 1000);

  const statement = db.prepare(`
    INSERT INTO articles (id, source, source_id, url, title, body, author, published_at, crawled_at, processed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(url) DO NOTHING
  `);

  const result = await statement
    .bind(
      id,
      input.source,
      input.source_id,
      input.url,
      input.title,
      input.body,
      input.author,
      input.published_at,
      now
    )
    .run();

  return result.success && (result.meta.changes ?? 0) > 0 ? id : null;
}

/**
 * Fetch articles that have not been processed by the LLM extractor yet.
 */
export async function getUnprocessedArticles(
  db: D1Database,
  limit: number = 20
): Promise<ArticleRecord[]> {
  const statement = db.prepare(`
    SELECT id, source, source_id, url, title, body, author, published_at, crawled_at, processed
    FROM articles
    WHERE processed = 0
    ORDER BY crawled_at ASC
    LIMIT ?
  `);

  const { results } = await statement.bind(limit).all<ArticleRecord>();
  return (results ?? []).map((row) => ({
    ...row,
    id: makeArticleId(row.id as unknown as string),
  }));
}

/**
 * Mark an article as processed in D1.
 */
export async function markArticleProcessed(
  db: D1Database,
  articleId: ArticleId
): Promise<boolean> {
  const statement = db.prepare('UPDATE articles SET processed = 1 WHERE id = ?');
  const result = await statement.bind(articleId).run();
  return result.success;
}
