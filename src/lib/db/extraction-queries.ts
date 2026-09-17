import { ArticleId, ExtractionId, ExtractionRecord, makeExtractionId } from './types';
import { StructuredExtraction } from '../llm/llm-types';

/**
 * Insert an LLM extraction record into D1.
 */
export async function insertExtraction(
  db: D1Database,
  articleId: ArticleId,
  extraction: StructuredExtraction
): Promise<ExtractionId | null> {
  const id = makeExtractionId(`ext_${crypto.randomUUID()}`);
  const now = Math.floor(Date.now() / 1000);

  const statement = db.prepare(`
    INSERT INTO extractions (
      id, article_id, summary, evidence, counter, context, verification_questions, extracted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = await statement
    .bind(
      id,
      articleId,
      extraction.summary,
      JSON.stringify(extraction.evidence),
      JSON.stringify(extraction.counter),
      JSON.stringify(extraction.context),
      JSON.stringify(extraction.verification_questions),
      now
    )
    .run();

  return result.success ? id : null;
}

/**
 * Get extraction for an article.
 */
export async function getExtractionForArticle(
  db: D1Database,
  articleId: ArticleId
): Promise<ExtractionRecord | null> {
  const statement = db.prepare(`
    SELECT id, article_id, summary, evidence, counter, context, verification_questions, extracted_at
    FROM extractions
    WHERE article_id = ?
    ORDER BY extracted_at DESC
    LIMIT 1
  `);

  const row = await statement.bind(articleId).first<ExtractionRecord>();
  if (!row) return null;

  return {
    ...row,
    id: makeExtractionId(row.id as unknown as string),
  };
}
