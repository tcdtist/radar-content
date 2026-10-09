import { getAuthorityWeight } from '../scoring/source-tiers';
import {
  ClusterCandidate,
  LinkedArticleExtraction,
  sendDiscordClusterAlert,
} from './discord-formatter';

export { sendDiscordClusterAlert } from './discord-formatter';

export interface NotificationResult {
  sentCount: number;
  notifiedClusterId?: string;
  reason?: string;
}

/**
 * Ensure notified_clusters state tracking table exists in D1.
 * Prevents repeat spam notifications forever for the same cluster.
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
 * Check if a cluster has already been notified.
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
 * Mark a cluster as notified in D1.
 */
export async function markClusterNotified(db: D1Database, clusterId: string): Promise<void> {
  await ensureNotifiedClustersTable(db);
  await db
    .prepare('INSERT OR IGNORE INTO notified_clusters (cluster_id) VALUES (?)')
    .bind(clusterId)
    .run();
}

/**
 * Anti-Spam Notification Engine:
 * 1. Checks for unnotified clusters in READY status with Score >= minScore (default 70).
 * 2. Requires at least one Tier 1/2 authority source (weight >= 0.75).
 * 3. Enforces strict limit (default 1) per cycle to prevent notification storms.
 */
export async function notifyPromotedClusters(
  db: D1Database,
  webhookUrl?: string,
  options: { minScore?: number; limit?: number } = {}
): Promise<NotificationResult> {
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    return { sentCount: 0, reason: 'Invalid or missing Discord webhook URL' };
  }

  await ensureNotifiedClustersTable(db);
  const minScore = options.minScore ?? 70;
  const limit = options.limit ?? 1;

  const candidateRows = await db
    .prepare(
      `SELECT c.id, c.label, c.score, c.status, c.topic_tags, c.article_count, c.source_count
       FROM clusters c
       WHERE c.status = 'READY'
         AND c.score >= ?
         AND c.id NOT IN (SELECT cluster_id FROM notified_clusters)
       ORDER BY c.score DESC
       LIMIT ?`
    )
    .bind(minScore, limit)
    .all<ClusterCandidate>();

  const candidates = candidateRows.results ?? [];
  if (candidates.length === 0) {
    return { sentCount: 0, reason: 'No new unnotified READY clusters meeting score threshold' };
  }

  let sentCount = 0;
  let lastNotifiedId: string | undefined;

  for (const cluster of candidates) {
    const articleRows = await db
      .prepare(
        `SELECT a.source, a.url, a.title, a.author, e.summary, e.evidence, e.counter
         FROM cluster_articles ca
         JOIN articles a ON ca.article_id = a.id
         LEFT JOIN extractions e ON a.id = e.article_id
         WHERE ca.cluster_id = ?
         LIMIT 5`
      )
      .bind(cluster.id)
      .all<LinkedArticleExtraction>();

    const articles = articleRows.results ?? [];

    // Anti-spam condition: Must contain at least 1 Tier 1/2 source (weight >= 0.75)
    const hasAuthority = articles.some((a) => getAuthorityWeight(a.source, a.url) >= 0.75);
    if (!hasAuthority) {
      continue;
    }

    try {
      const ok = await sendDiscordClusterAlert(webhookUrl, cluster, articles);
      if (ok) {
        await markClusterNotified(db, cluster.id);
        sentCount++;
        lastNotifiedId = cluster.id;
      }
    } catch (err) {
      console.error(`[DiscordNotifier] Failed to notify cluster ${cluster.id}:`, err);
    }
  }

  return { sentCount, notifiedClusterId: lastNotifiedId };
}
