import { getAuthorityWeight } from '../scoring/source-tiers';
import {
  ClusterCandidate,
  LinkedArticleExtraction,
  sendDiscordClusterAlert,
} from './discord-formatter';
import { resolveClusterTranslation } from './discord-translation-helper';
import { CardToTranslate } from '../llm/translation-prompt';
import { TranslatedCardContent } from '../llm/translator';

export { sendDiscordClusterAlert } from './discord-formatter';
export type { DiscordAlertOptions } from './discord-formatter';

export interface NotificationResult {
  sentCount: number;
  notifiedClusterId?: string;
  reason?: string;
}

export interface NotifyClusterOptions {
  minScore?: number;
  limit?: number;
  clusterId?: string;
  force?: boolean;
  appBaseUrl?: string;
  translateFn?: (card: CardToTranslate) => Promise<TranslatedCardContent>;
}

export {
  ensureNotifiedClustersTable,
  isClusterNotified,
  isClusterStoryAlreadyNotified,
  markClusterNotified,
} from './discord-story-dedup';

import {
  ensureNotifiedClustersTable,
  isClusterStoryAlreadyNotified,
  markClusterNotified,
} from './discord-story-dedup';

export async function notifyPromotedClusters(
  db: D1Database,
  webhookUrl?: string,
  options: NotifyClusterOptions = {}
): Promise<NotificationResult> {
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    return { sentCount: 0, reason: 'Invalid or missing Discord webhook URL' };
  }

  await ensureNotifiedClustersTable(db);
  const minScore = options.minScore ?? 70;

  if (!options.force) {
    const cutoff = Math.floor(Date.now() / 1000) - 86400;
    const sentTodayRow = await db
      .prepare('SELECT count(*) as count FROM notified_clusters WHERE notified_at >= ?')
      .bind(cutoff)
      .first<{ count: number }>();
    if ((sentTodayRow?.count ?? 0) >= 10) {
      return { sentCount: 0, reason: 'Daily notification limit of 10 reached' };
    }
  }

  let candidates: ClusterCandidate[] = [];
  if (options.clusterId) {
    const row = await db
      .prepare(
        `SELECT c.id, c.label, c.score, c.status, c.topic_tags, c.article_count, c.source_count
         FROM clusters c
         WHERE c.id = ?
         LIMIT 1`
      )
      .bind(options.clusterId)
      .first<ClusterCandidate>();
    if (row) candidates = [row];
  } else {
    const candidateRows = await db
      .prepare(
        `SELECT c.id, c.label, c.score, c.status, c.topic_tags, c.article_count, c.source_count
         FROM clusters c
         WHERE c.status = 'READY'
           AND c.created_at >= unixepoch() - 7 * 86400
           AND c.score >= ?
           AND c.id NOT IN (SELECT cluster_id FROM notified_clusters)
         ORDER BY c.score DESC
         LIMIT ?`
      )
      .bind(minScore, options.limit ?? 1)
      .all<ClusterCandidate>();
    candidates = candidateRows.results ?? [];
  }

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
         LEFT JOIN extractions e ON e.id = (
           SELECT e2.id FROM extractions e2 WHERE e2.article_id = a.id ORDER BY e2.extracted_at DESC LIMIT 1
         )
         WHERE ca.cluster_id = ?
         LIMIT 5`
      )
      .bind(cluster.id)
      .all<LinkedArticleExtraction>();

    const articles = articleRows.results ?? [];

    if (!options.force) {
      const hasAuthority = articles.some((a) => getAuthorityWeight(a.source, a.url) >= 0.75);
      if (!hasAuthority) continue;

      const isAlreadyCovered = await isClusterStoryAlreadyNotified(db, cluster, articles);
      if (isAlreadyCovered) {
        await markClusterNotified(db, cluster.id);
        continue;
      }
    }

    try {
      const translatedContent = await resolveClusterTranslation(db, cluster, articles, options.translateFn);
      const ok = await sendDiscordClusterAlert(webhookUrl, cluster, articles, {
        translatedContent,
        appBaseUrl: options.appBaseUrl,
      });
      if (ok) {
        await markClusterNotified(db, cluster.id);
        sentCount++;
        lastNotifiedId = cluster.id;
      }
    } catch (err) {
      console.error(`[DiscordNotifier] Failed to notify cluster ${cluster.id}:`, err);
    }
  }

  if (sentCount === 0 && candidates.length > 0) {
    return { sentCount: 0, reason: 'All candidate clusters were already notified or duplicate stories' };
  }

  return { sentCount, notifiedClusterId: lastNotifiedId };
}
