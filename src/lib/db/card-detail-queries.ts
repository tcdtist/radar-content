import { MOCK_INTELLIGENCE_CARDS } from '../data/mock-cards';
import { computeCardFreshness, computeCardHighestTier } from '../scoring/card-metadata';
import { CardStatus, ClusterId, makeClusterId, ScoredIntelligenceCard, SourceType } from './types';

/**
 * Fetch a single scored intelligence card by cluster ID from D1 or mock fallback.
 */
export async function queryCardById(
  db: D1Database,
  cardId: ClusterId
): Promise<ScoredIntelligenceCard | null> {
  const clusterRow = await db
    .prepare(
      `SELECT id, label, topic_tags, score, status, article_count, source_count, created_at, updated_at
       FROM clusters
       WHERE id = ?
       LIMIT 1`
    )
    .bind(cardId)
    .first<{
      id: string;
      label: string | null;
      topic_tags: string;
      score: number;
      status: string;
      article_count: number;
      source_count: number;
      created_at: number;
      updated_at: number;
    }>();

  if (!clusterRow) {
    // Check mock cards fallback
    const mockCard = MOCK_INTELLIGENCE_CARDS.find((c) => c.id === cardId);
    return mockCard || null;
  }

  const articleQuery = await db
    .prepare(
      `SELECT a.id, a.title, a.url, a.source, a.author, a.published_at, a.crawled_at,
              e.summary, e.evidence, e.counter, e.context, e.verification_questions
       FROM cluster_articles ca
       JOIN articles a ON ca.article_id = a.id
       LEFT JOIN extractions e ON e.id = (
         SELECT e2.id FROM extractions e2 WHERE e2.article_id = a.id ORDER BY e2.extracted_at DESC LIMIT 1
       )
       WHERE ca.cluster_id = ?
       ORDER BY a.published_at DESC, a.crawled_at DESC
       LIMIT 10`
    )
    .bind(cardId)
    .all<{
      id: string;
      title: string;
      url: string;
      source: string;
      author: string | null;
      published_at: number | null;
      crawled_at: number | null;
      summary: string | null;
      evidence: string | null;
      counter: string | null;
      context: string | null;
      verification_questions: string | null;
    }>();

  const articles = articleQuery.results ?? [];
  const uniqueArticlesMap = new Map<string, typeof articles[0]>();
  for (const art of articles) {
    const key = art.url || art.id;
    if (!uniqueArticlesMap.has(key)) {
      uniqueArticlesMap.set(key, art);
    }
  }
  const uniqueArticles = Array.from(uniqueArticlesMap.values());

  const evidenceList: string[] = [];
  const counterList: string[] = [];
  const contextList: string[] = [];
  const questionsList: string[] = [];
  let bestSummary = '';

  for (const art of uniqueArticles) {
    if (!bestSummary && art.summary && art.summary.trim().length > 0) {
      bestSummary = art.summary.trim();
    }
    if (art.evidence) {
      try {
        const parsed = JSON.parse(art.evidence);
        if (Array.isArray(parsed)) evidenceList.push(...parsed);
      } catch {}
    }
    if (art.counter) {
      try {
        const parsed = JSON.parse(art.counter);
        if (Array.isArray(parsed)) counterList.push(...parsed);
      } catch {}
    }
    if (art.context) {
      try {
        const parsed = JSON.parse(art.context);
        if (Array.isArray(parsed)) contextList.push(...parsed);
      } catch {}
    }
    if (art.verification_questions) {
      try {
        const parsed = JSON.parse(art.verification_questions);
        if (Array.isArray(parsed)) questionsList.push(...parsed);
      } catch {}
    }
  }

  const tags: string[] = JSON.parse(clusterRow.topic_tags || '["AI"]');

  return {
    id: makeClusterId(clusterRow.id),
    label: clusterRow.label || 'Topic Discussion',
    topic_tags: tags,
    score: clusterRow.score,
    status: (clusterRow.status as CardStatus) || 'LEAD',
    article_count: clusterRow.article_count || uniqueArticles.length,
    source_count: clusterRow.source_count > 0 ? clusterRow.source_count : new Set(uniqueArticles.map((a) => a.source)).size,
    created_at: clusterRow.created_at,
    updated_at: clusterRow.updated_at,
    summary: bestSummary || clusterRow.label || 'Technical Intelligence Signal',
    evidence: Array.from(new Set(evidenceList)),
    counter: Array.from(new Set(counterList)),
    context: Array.from(new Set(contextList)),
    verification_questions: Array.from(new Set(questionsList)),
    entities: [],
    sources: uniqueArticles.map((a) => ({
      title: a.title,
      url: a.url,
      source: (a.source as SourceType) || 'rss',
      author: a.author,
      published_at: a.published_at,
      crawled_at: a.crawled_at,
    })),
    freshness: computeCardFreshness(clusterRow.created_at, uniqueArticles),
    highest_tier: computeCardHighestTier(uniqueArticles.map((a) => ({
      source: (a.source as SourceType) || 'rss',
      url: a.url,
    }))),
  };
}
