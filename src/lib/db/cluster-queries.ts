import { computeCardFreshness, computeCardHighestTier } from '../scoring/card-metadata';
import { ScoringEngine } from '../scoring/scoring-engine';
import { normalizeClusterLabelKey } from '../graph/cluster-builder-utils';
import {
  ClusterRecord,
  makeClusterId,
  ScoredIntelligenceCard,
  SourceType,
} from './types';

export { linkClusterArticle, updateCardStatus, upsertCluster } from './cluster-mutations';

export interface CardQueryFilters {
  topic?: string;
  status?: string; // Comma-separated: "READY,LEAD"
  sort?: 'score' | 'newest' | 'evidence';
  limit?: number;
  page?: number;
  nowSeconds?: number;
  minScore?: number;
}

const scoringEngine = new ScoringEngine();

export async function queryCards(
  db: D1Database,
  filters: CardQueryFilters
): Promise<ScoredIntelligenceCard[]> {
  const statusList = filters.status
    ? filters.status.split(',').map((s) => s.trim().toUpperCase())
    : ['READY', 'LEAD'];

  const placeholders = statusList.map(() => '?').join(',');
  let orderBy = 'c.score DESC';
  if (filters.sort === 'newest') {
    orderBy = 'c.created_at DESC, c.updated_at DESC';
  }
  if (filters.sort === 'evidence') orderBy = 'c.article_count DESC';

  const limit = filters.limit || 50;
  const page = Math.max(1, filters.page || 1);
  const offset = (page - 1) * limit;

  const clusterSql = `
    SELECT c.id, c.label, c.topic_tags, c.score, c.status, c.article_count, c.source_count, c.created_at, c.updated_at
    FROM clusters c
    WHERE c.status IN (${placeholders})
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;

  const clusterRows = await db.prepare(clusterSql).bind(...statusList, limit, offset).all<ClusterRecord>();
  const clusters = clusterRows.results ?? [];

  const cards: ScoredIntelligenceCard[] = [];
  const seenLabelKeys = new Set<string>();
  const seenClusterIds = new Set<string>();

  for (const c of clusters) {
    const clusterId = makeClusterId(c.id as unknown as string);
    if (seenClusterIds.has(clusterId)) continue;
    const labelKey = c.label ? normalizeClusterLabelKey(c.label) : '';
    if (labelKey && seenLabelKeys.has(labelKey)) continue;

    const tags: string[] = JSON.parse(c.topic_tags || '["AI"]');

    if (filters.topic && filters.topic !== 'all' && !tags.some((t) => t.toLowerCase() === filters.topic?.toLowerCase())) {
      continue;
    }

    // Fetch linked articles and extractions
    const articleQuery = await db.prepare(`
      SELECT a.id, a.title, a.url, a.source, a.author, a.published_at, a.crawled_at,
             e.summary, e.evidence, e.counter, e.context, e.verification_questions
      FROM cluster_articles ca
      JOIN articles a ON ca.article_id = a.id
      LEFT JOIN extractions e ON e.id = (
        SELECT e2.id FROM extractions e2 WHERE e2.article_id = a.id ORDER BY e2.extracted_at DESC LIMIT 1
      )
      WHERE ca.cluster_id = ?
      ORDER BY a.published_at DESC, a.crawled_at DESC
      LIMIT 10
    `).bind(clusterId).all<{
      id: string;
      title: string;
      url: string;
      source: SourceType;
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

    const parseJsonArray = (val: string | null): string[] => {
      if (!val) return [];
      try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
    };

    for (const art of uniqueArticles) {
      if (!bestSummary && art.summary && art.summary.trim().length > 0) {
        bestSummary = art.summary.trim();
      }
      evidenceList.push(...parseJsonArray(art.evidence));
      counterList.push(...parseJsonArray(art.counter));
      contextList.push(...parseJsonArray(art.context));
      questionsList.push(...parseJsonArray(art.verification_questions));
    }

    if (!bestSummary) {
      bestSummary = c.label || 'Technical Intelligence Signal';
    }

    const articleTimes = uniqueArticles.map((a) => a.published_at ?? a.crawled_at ?? 0).filter((t) => t > 0);
    const latestActivityAt = articleTimes.length > 0 ? Math.max(...articleTimes) : c.created_at;
    const score = filters.sort === 'newest'
      ? c.score
      : scoringEngine.computeDynamicVelocityScore(c.score, c.created_at, latestActivityAt, filters.nowSeconds);

    if (filters.minScore !== undefined && score < filters.minScore) {
      continue;
    }

    seenClusterIds.add(clusterId);
    if (labelKey) seenLabelKeys.add(labelKey);

    cards.push({
      id: clusterId,
      label: c.label || 'Topic Discussion',
      topic_tags: tags,
      score,
      status: c.status,
      article_count: c.article_count || uniqueArticles.length,
      source_count: c.source_count > 0 ? c.source_count : new Set(uniqueArticles.map((a) => a.source)).size,
      created_at: c.created_at,
      updated_at: c.updated_at,
      summary: bestSummary,
      evidence: Array.from(new Set(evidenceList)),
      counter: Array.from(new Set(counterList)),
      context: Array.from(new Set(contextList)),
      verification_questions: Array.from(new Set(questionsList)),
      entities: [],
      sources: uniqueArticles.map((a) => ({
        title: a.title,
        url: a.url,
        source: a.source,
        author: a.author,
        published_at: a.published_at,
        crawled_at: a.crawled_at,
      })),
      freshness: computeCardFreshness(c.created_at, uniqueArticles, filters.nowSeconds),
      highest_tier: computeCardHighestTier(uniqueArticles),
    });
  }

  if (!filters.sort || filters.sort === 'score') {
    cards.sort((a, b) => b.score - a.score);
  }

  return cards;
}

export { getDashboardStats } from './dashboard-stats-queries';
