import { ArticleId, CardStatus, ClusterId, ClusterRecord } from './types';

export async function upsertCluster(
  db: D1Database,
  cluster: Omit<ClusterRecord, 'created_at' | 'updated_at'>
): Promise<ClusterId> {
  const now = Math.floor(Date.now() / 1000);

  await db.prepare(`
    INSERT INTO clusters (id, label, topic_tags, score, status, article_count, source_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      topic_tags = excluded.topic_tags,
      score = excluded.score,
      status = CASE WHEN clusters.status IN ('SAVED', 'WRITTEN', 'DISMISSED') THEN clusters.status ELSE excluded.status END,
      article_count = excluded.article_count,
      source_count = excluded.source_count,
      updated_at = excluded.updated_at
  `).bind(
    cluster.id,
    cluster.label,
    cluster.topic_tags,
    cluster.score,
    cluster.status,
    cluster.article_count,
    cluster.source_count,
    now,
    now
  ).run();

  return cluster.id;
}

export async function linkClusterArticle(
  db: D1Database,
  clusterId: ClusterId,
  articleId: ArticleId
): Promise<void> {
  await db.prepare(`
    INSERT INTO cluster_articles (cluster_id, article_id)
    VALUES (?, ?)
    ON CONFLICT(cluster_id, article_id) DO NOTHING
  `).bind(clusterId, articleId).run();
}

export async function updateCardStatus(
  db: D1Database,
  clusterId: ClusterId,
  status: CardStatus
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db.prepare(`
    UPDATE clusters SET status = ?, updated_at = ? WHERE id = ?
  `).bind(status, now, clusterId).run();

  return result.success;
}
