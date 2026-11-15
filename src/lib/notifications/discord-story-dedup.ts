import { ClusterCandidate, LinkedArticleExtraction } from './discord-formatter';

/**
 * Ensures the notified_clusters table exists in D1.
 */
export async function ensureNotifiedClustersTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS notified_clusters (
         cluster_id TEXT PRIMARY KEY,
         notified_at INTEGER NOT NULL DEFAULT (unixepoch())
       )`
    )
    .run();
}

/**
 * Checks whether a cluster has already been notified to Discord.
 */
export async function isClusterNotified(db: D1Database, clusterId: string): Promise<boolean> {
  await ensureNotifiedClustersTable(db);
  const row = await db
    .prepare('SELECT 1 FROM notified_clusters WHERE cluster_id = ?')
    .bind(clusterId)
    .first();
  return Boolean(row);
}

/**
 * Marks a cluster as notified in the database.
 */
export async function markClusterNotified(db: D1Database, clusterId: string): Promise<void> {
  await ensureNotifiedClustersTable(db);
  await db
    .prepare('INSERT OR IGNORE INTO notified_clusters (cluster_id) VALUES (?)')
    .bind(clusterId)
    .run();
}

/**
 * Detects whether this cluster or its lead articles represent a story that was already notified.
 */
export async function isClusterStoryAlreadyNotified(
  db: D1Database,
  cluster: ClusterCandidate,
  articles: LinkedArticleExtraction[]
): Promise<boolean> {
  await ensureNotifiedClustersTable(db);

  // 1. Direct label match with another cluster notified previously
  const labelMatch = await db
    .prepare(
      `SELECT 1 FROM clusters c
       JOIN notified_clusters nc ON c.id = nc.cluster_id
       WHERE c.id != ?
         AND lower(trim(c.label)) = lower(trim(?))
       LIMIT 1`
    )
    .bind(cluster.id, cluster.label)
    .first();

  if (labelMatch) return true;

  // 2. Lead article / URL overlap: prevent reposting identical news story
  const leadUrls = articles
    .slice(0, 3)
    .map((a) => a.url)
    .filter(Boolean);

  if (leadUrls.length > 0) {
    const placeholders = leadUrls.map(() => '?').join(',');
    const articleMatch = await db
      .prepare(
        `SELECT 1 FROM cluster_articles ca
         JOIN articles a ON ca.article_id = a.id
         JOIN notified_clusters nc ON ca.cluster_id = nc.cluster_id
         WHERE nc.cluster_id != ?
           AND a.url IN (${placeholders})
         LIMIT 1`
      )
      .bind(cluster.id, ...leadUrls)
      .first();

    if (articleMatch) return true;
  }

  return false;
}
