import { linkClusterArticle, upsertCluster } from '../db/cluster-queries';
import { migrateTranslations } from '../db/translation-queries';
import { CardStatus, makeArticleId, makeClusterId, SourceType } from '../db/types';
import { ScoringEngine } from '../scoring/scoring-engine';
import { getAuthorityWeight } from '../scoring/source-tiers';
import { deriveClusterLabel, deriveStableClusterId, determineClusterTags } from './cluster-builder-utils';
import { fetchGraph } from './graph-queries';
import { LeidenAlgorithm } from './leiden-algorithm';

export const SEAL_WINDOW_SECONDS = 7 * 86400;

export interface ClusteringRunSummary {
  communitiesDetected: number;
  clustersUpserted: number;
  translationsMigrated: number;
}

export class ClusterBuilder {
  constructor(
    private leiden = new LeidenAlgorithm(),
    private scorer = new ScoringEngine()
  ) {}

  async buildClustersFromGraph(db: D1Database, targetEntityIds?: string[]): Promise<ClusteringRunSummary> {
    const { nodes, edges } = await fetchGraph(db);
    if (nodes.length === 0) {
      return { communitiesDetected: 0, clustersUpserted: 0, translationsMigrated: 0 };
    }

    const communityMap = this.leiden.detectCommunities(nodes, edges);
    const communities = new Map<number, string[]>();

    for (const [nodeId, commId] of communityMap.entries()) {
      const list = communities.get(commId) || [];
      list.push(nodeId);
      communities.set(commId, list);
    }

    let clustersUpserted = 0;
    let translationsMigrated = 0;
    const now = Math.floor(Date.now() / 1000);
    const targetSet = targetEntityIds && targetEntityIds.length > 0 ? new Set(targetEntityIds) : null;

    for (const [, entityIds] of communities.entries()) {
      if (entityIds.length === 0) continue;
      if (targetSet && !entityIds.some((id) => targetSet.has(id))) continue;

      const communityEntities = nodes
        .filter((n) => entityIds.includes(n.id))
        .sort((a, b) => b.weight - a.weight);

      const topEntities = communityEntities.slice(0, 3).map((n) => n.name);
      const queryEntityIds = communityEntities.slice(0, 25).map((n) => n.id);

      const label = deriveClusterLabel(topEntities);
      const baseStableId = deriveStableClusterId(entityIds);
      const baseClusterId = makeClusterId(baseStableId);

      const existingCluster = await db.prepare(
        'SELECT created_at, status FROM clusters WHERE id = ? LIMIT 1'
      ).bind(baseClusterId).first<{ created_at: number; status: CardStatus }>();

      const isBaseSealed = Boolean(
        existingCluster && (
          existingCluster.status === 'SEALED' ||
          (now - existingCluster.created_at) > (SEAL_WINDOW_SECONDS - 2 * 86400)
        )
      );

      if (existingCluster && existingCluster.status !== 'SEALED' && (now - existingCluster.created_at) > SEAL_WINDOW_SECONDS) {
        await db.prepare("UPDATE clusters SET status = 'SEALED', updated_at = unixepoch() WHERE id = ?").bind(baseClusterId).run();
      }

      // Query articles linked to top entities in this community (max 25 variables)
      // Hard 7-day rolling horizon: active radar waves strictly cluster fresh articles
      const activeCutoff = now - SEAL_WINDOW_SECONDS;
      const placeholders = queryEntityIds.map(() => '?').join(',');
      const articleRows = await db.prepare(`
        SELECT DISTINCT a.id, a.source, a.url, a.published_at, a.crawled_at, e.evidence
        FROM article_entities ae
        JOIN articles a ON ae.article_id = a.id
        LEFT JOIN extractions e ON a.id = e.article_id
        WHERE ae.entity_id IN (${placeholders})
          AND (a.crawled_at >= ? OR a.published_at >= ?)
        ORDER BY a.crawled_at DESC LIMIT 15
      `).bind(...queryEntityIds, activeCutoff, activeCutoff).all<{
        id: string;
        source: SourceType;
        url: string;
        published_at: number | null;
        crawled_at: number;
        evidence: string | null;
      }>();

      let articles = articleRows.results ?? [];

      if (articles.length === 0 && topEntities.length > 0) {
        const likes = topEntities.map(() => 'a.title LIKE ?').join(' OR ');
        const params = topEntities.map((name) => `%${name}%`);
        const fallbackRows = await db.prepare(`
          SELECT DISTINCT a.id, a.source, a.url, a.published_at, a.crawled_at, e.evidence
          FROM articles a
          LEFT JOIN extractions e ON a.id = e.article_id
          WHERE (${likes})
            AND (a.crawled_at >= ? OR a.published_at >= ?)
          ORDER BY a.crawled_at DESC LIMIT 10
        `).bind(...params, activeCutoff, activeCutoff).all<{
          id: string;
          source: SourceType;
          url: string;
          published_at: number | null;
          crawled_at: number;
          evidence: string | null;
        }>();
        articles = fallbackRows.results ?? [];
      }

      const freshArticles = articles.filter(
        (a) => (now - (a.published_at ?? a.crawled_at)) <= SEAL_WINDOW_SECONDS || (now - a.crawled_at) <= SEAL_WINDOW_SECONDS
      );
      if (freshArticles.length === 0) continue;
      articles = freshArticles;

      const earliestArticleTime = Math.min(...articles.map((a) => a.published_at ?? a.crawled_at ?? now));
      let clusterId = baseClusterId;
      let clusterCreatedAt = Math.min(existingCluster?.created_at ?? earliestArticleTime, earliestArticleTime);

      if (isBaseSealed) {
        const waveSuffix = `w${Math.floor(now / SEAL_WINDOW_SECONDS)}`;
        clusterId = makeClusterId(deriveStableClusterId(entityIds, waveSuffix));
        const waveRow = await db.prepare('SELECT created_at FROM clusters WHERE id = ? LIMIT 1').bind(clusterId).first<{ created_at: number }>();
        clusterCreatedAt = waveRow?.created_at ?? earliestArticleTime;
      }

      // Check legacy non-deterministic cluster for translation migration
      const legacyRow = await db.prepare(
        `SELECT id FROM clusters WHERE label = ? AND id != ? AND id LIKE 'cluster_comm_%' AND status != 'SEALED' LIMIT 1`
      ).bind(label, clusterId).first<{ id: string }>();

      if (legacyRow) {
        const migrated = await migrateTranslations(db, makeClusterId(legacyRow.id), clusterId);
        if (migrated) translationsMigrated++;
        await db.prepare('DELETE FROM cluster_articles WHERE cluster_id = ?').bind(legacyRow.id).run();
        await db.prepare('DELETE FROM clusters WHERE id = ?').bind(legacyRow.id).run();
      }

      const sources = articles.map((a) => a.source);
      const publishedTimes = articles.map((a) => a.published_at).filter((t): t is number => t !== null);

      let evidenceCount = 0;
      for (const a of articles) {
        if (a.evidence) {
          try {
            const ev = JSON.parse(a.evidence);
            if (Array.isArray(ev)) evidenceCount += ev.length;
          } catch {}
        }
      }

      const scoreInput = {
        sources,
        sourceWeights: articles.map((a) => getAuthorityWeight(a.source, a.url)),
        evidenceCount: Math.max(1, evidenceCount),
        claimCount: Math.max(1, articles.length * 2),
        totalEngagement: articles.length * 120,
        publishedAtTimestamps: publishedTimes,
        clusterCreatedAt,
      };

      const scoreComp = this.scorer.computeScore(scoreInput);
      const status: CardStatus = this.scorer.determineStatus(scoreInput, 'LEAD', now, scoreComp.finalScore);
      const tags = determineClusterTags(label, topEntities);

      await upsertCluster(db, {
        id: clusterId,
        label,
        topic_tags: JSON.stringify(tags),
        score: scoreComp.finalScore,
        status,
        article_count: articles.length,
        source_count: new Set(sources).size,
        created_at: clusterCreatedAt,
      });

      for (const art of articles) {
        await linkClusterArticle(db, clusterId, makeArticleId(art.id));
      }

      clustersUpserted++;
    }

    return {
      communitiesDetected: communities.size,
      clustersUpserted,
      translationsMigrated,
    };
  }
}
