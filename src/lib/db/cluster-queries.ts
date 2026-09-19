import {
  ClusterRecord,
  makeClusterId,
  ScoredIntelligenceCard,
  SourceType,
} from './types';

export {
  linkClusterArticle,
  updateCardStatus,
  upsertCluster,
} from './cluster-mutations';

export interface CardQueryFilters {
  topic?: string;
  status?: string; // Comma-separated: "READY,LEAD"
  sort?: 'score' | 'newest' | 'evidence';
  limit?: number;
  page?: number;
}

export async function queryCards(
  db: D1Database,
  filters: CardQueryFilters
): Promise<ScoredIntelligenceCard[]> {
  const statusList = filters.status
    ? filters.status.split(',').map((s) => s.trim().toUpperCase())
    : ['READY', 'LEAD'];

  const placeholders = statusList.map(() => '?').join(',');
  let orderBy = 'score DESC';
  if (filters.sort === 'newest') orderBy = 'updated_at DESC';
  if (filters.sort === 'evidence') orderBy = 'article_count DESC';

  const limit = filters.limit || 50;
  const page = Math.max(1, filters.page || 1);
  const offset = (page - 1) * limit;

  const clusterSql = `
    SELECT id, label, topic_tags, score, status, article_count, source_count, created_at, updated_at
    FROM clusters
    WHERE status IN (${placeholders})
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;

  const clusterRows = await db.prepare(clusterSql).bind(...statusList, limit, offset).all<ClusterRecord>();
  const clusters = clusterRows.results ?? [];

  const cards: ScoredIntelligenceCard[] = [];

  for (const c of clusters) {
    const clusterId = makeClusterId(c.id as unknown as string);
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
      LEFT JOIN extractions e ON a.id = e.article_id
      WHERE ca.cluster_id = ?
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
    const evidenceList: string[] = [];
    const counterList: string[] = [];
    const contextList: string[] = [];
    const questionsList: string[] = [];
    let bestSummary = '';

    for (const art of articles) {
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

    if (!bestSummary) {
      bestSummary = c.label || 'Technical Intelligence Signal';
    }

    cards.push({
      id: clusterId,
      label: c.label || 'Topic Discussion',
      topic_tags: tags,
      score: c.score,
      status: c.status,
      article_count: c.article_count,
      source_count: c.source_count,
      created_at: c.created_at,
      updated_at: c.updated_at,
      summary: bestSummary,
      evidence: Array.from(new Set(evidenceList)),
      counter: Array.from(new Set(counterList)),
      context: Array.from(new Set(contextList)),
      verification_questions: Array.from(new Set(questionsList)),
      entities: [],
      sources: articles.map((a) => ({
        title: a.title,
        url: a.url,
        source: a.source,
        author: a.author,
        published_at: a.published_at,
        crawled_at: a.crawled_at,
      })),
    });
  }

  return cards;
}

export async function getDashboardStats(db: D1Database): Promise<{
  totalArticles: number;
  totalClusters: number;
  readyCount: number;
  writtenCount: number;
}> {
  const artCount = await db.prepare('SELECT count(*) as count FROM articles').first<{ count: number }>();
  const cluCount = await db.prepare('SELECT count(*) as count FROM clusters').first<{ count: number }>();
  const ready = await db.prepare("SELECT count(*) as count FROM clusters WHERE status = 'READY'").first<{ count: number }>();
  const written = await db.prepare("SELECT count(*) as count FROM clusters WHERE status = 'WRITTEN'").first<{ count: number }>();

  return {
    totalArticles: artCount?.count ?? 0,
    totalClusters: cluCount?.count ?? 0,
    readyCount: ready?.count ?? 0,
    writtenCount: written?.count ?? 0,
  };
}
