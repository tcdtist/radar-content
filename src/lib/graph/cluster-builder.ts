import { linkClusterArticle, upsertCluster } from '../db/cluster-queries';
import { migrateTranslations } from '../db/translation-queries';
import { CardStatus, makeArticleId, makeClusterId, SourceType } from '../db/types';
import { ScoringEngine } from '../scoring/scoring-engine';
import { getAuthorityWeight } from '../scoring/source-tiers';
import { fetchGraph } from './graph-queries';
import { LeidenAlgorithm } from './leiden-algorithm';

export interface ClusteringRunSummary {
  communitiesDetected: number;
  clustersUpserted: number;
  translationsMigrated: number;
}

export class ClusterBuilder {
  private leiden: LeidenAlgorithm;
  private scorer: ScoringEngine;

  constructor(leiden = new LeidenAlgorithm(), scorer = new ScoringEngine()) {
    this.leiden = leiden;
    this.scorer = scorer;
  }

  /**
   * Derive a deterministic cluster ID from sorted entity member set.
   * Same entities → same hash → stable cluster ID across pipeline runs.
   */
  private deriveStableClusterId(entityIds: string[]): string {
    const sorted = [...entityIds].sort();
    const key = sorted.join('|');
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const ch = key.charCodeAt(i);
      hash = ((hash << 5) - hash + ch) | 0;
    }
    return `cluster_${Math.abs(hash).toString(36)}`;
  }

  async buildClustersFromGraph(db: D1Database): Promise<ClusteringRunSummary> {
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

    for (const [, entityIds] of communities.entries()) {
      if (entityIds.length === 0) continue;

      // Find top entity names for naming the cluster
      const topEntities = nodes
        .filter((n) => entityIds.includes(n.id))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
        .map((n) => n.name);

      const formatTitle = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
      const label = topEntities.length > 0
        ? (topEntities.length === 1
            ? formatTitle(topEntities[0])
            : `${formatTitle(topEntities[0])} · ${topEntities.slice(1, 3).join(', ')}`)
        : `Topic Group`;

      // Deterministic cluster ID from entity member set (stable across Leiden runs)
      const stableId = this.deriveStableClusterId(entityIds);
      const clusterId = makeClusterId(stableId);

      // Check for legacy non-deterministic cluster with same label → migrate translation
      const legacyRow = await db.prepare(
        `SELECT id FROM clusters WHERE label = ? AND id != ? LIMIT 1`
      ).bind(label, clusterId).first<{ id: string }>();

      if (legacyRow) {
        const migrated = await migrateTranslations(db, makeClusterId(legacyRow.id), clusterId);
        if (migrated) translationsMigrated++;
        // Clean up legacy cluster (articles will be re-linked to stable ID)
        await db.prepare('DELETE FROM cluster_articles WHERE cluster_id = ?').bind(legacyRow.id).run();
        await db.prepare('DELETE FROM clusters WHERE id = ?').bind(legacyRow.id).run();
      }

      // Query articles linked to these entityIds
      const placeholders = entityIds.map(() => '?').join(',');
      const articleRows = await db.prepare(`
        SELECT DISTINCT a.id, a.source, a.url, a.published_at, e.evidence
        FROM article_entities ae
        JOIN articles a ON ae.article_id = a.id
        LEFT JOIN extractions e ON a.id = e.article_id
        WHERE ae.entity_id IN (${placeholders})
        ORDER BY a.crawled_at DESC LIMIT 15
      `).bind(...entityIds).all<{
        id: string;
        source: SourceType;
        url: string;
        published_at: number | null;
        evidence: string | null;
      }>();

      let articles = articleRows.results ?? [];

      // Fallback matching by entity names in title/body if article_entities is empty
      if (articles.length === 0 && topEntities.length > 0) {
        const likes = topEntities.map(() => 'a.title LIKE ?').join(' OR ');
        const params = topEntities.map((name) => `%${name}%`);
        const fallbackRows = await db.prepare(`
          SELECT DISTINCT a.id, a.source, a.url, a.published_at, e.evidence
          FROM articles a
          LEFT JOIN extractions e ON a.id = e.article_id
          WHERE ${likes}
          ORDER BY a.crawled_at DESC LIMIT 10
        `).bind(...params).all<{
          id: string;
          source: SourceType;
          url: string;
          published_at: number | null;
          evidence: string | null;
        }>();
        articles = fallbackRows.results ?? [];
      }

      if (articles.length === 0) continue;

      const sources = articles.map((a) => a.source);
      const publishedTimes = articles
        .map((a) => a.published_at)
        .filter((t): t is number => t !== null);

      let evidenceCount = 0;
      for (const a of articles) {
        if (a.evidence) {
          try {
            const ev = JSON.parse(a.evidence);
            if (Array.isArray(ev)) evidenceCount += ev.length;
          } catch {}
        }
      }

      const existingCluster = await db.prepare(
        'SELECT created_at FROM clusters WHERE id = ? LIMIT 1'
      ).bind(clusterId).first<{ created_at: number }>();
      const clusterCreatedAt = existingCluster?.created_at ?? Math.floor(Date.now() / 1000);

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
      const status: CardStatus = this.scorer.determineStatus(scoreInput);

      // Determine dynamic topic tags based on label and top entities
      const textForTag = `${label} ${topEntities.join(' ')}`.toLowerCase();
      const tags: string[] = ['AI'];
      if (textForTag.includes('system') || textForTag.includes('model') || textForTag.includes('route') || textForTag.includes('bench')) {
        tags.push('System Design');
      }
      if (textForTag.includes('api') || textForTag.includes('backend') || textForTag.includes('database') || textForTag.includes('provider')) {
        tags.push('Backend');
      }

      await upsertCluster(db, {
        id: clusterId,
        label,
        topic_tags: JSON.stringify(Array.from(new Set(tags))),
        score: scoreComp.finalScore,
        status,
        article_count: articles.length,
        source_count: new Set(sources).size,
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
