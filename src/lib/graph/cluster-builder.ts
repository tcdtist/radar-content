import { linkClusterArticle, upsertCluster } from '../db/cluster-queries';
import { CardStatus, makeArticleId, makeClusterId, SourceType } from '../db/types';
import { ScoringEngine } from '../scoring/scoring-engine';
import { fetchGraph } from './graph-queries';
import { LeidenAlgorithm } from './leiden-algorithm';

export interface ClusteringRunSummary {
  communitiesDetected: number;
  clustersUpserted: number;
}

export class ClusterBuilder {
  private leiden: LeidenAlgorithm;
  private scorer: ScoringEngine;

  constructor(leiden = new LeidenAlgorithm(), scorer = new ScoringEngine()) {
    this.leiden = leiden;
    this.scorer = scorer;
  }

  async buildClustersFromGraph(db: D1Database): Promise<ClusteringRunSummary> {
    const { nodes, edges } = await fetchGraph(db);
    if (nodes.length === 0) {
      return { communitiesDetected: 0, clustersUpserted: 0 };
    }

    const communityMap = this.leiden.detectCommunities(nodes, edges);
    const communities = new Map<number, string[]>();

    for (const [nodeId, commId] of communityMap.entries()) {
      const list = communities.get(commId) || [];
      list.push(nodeId);
      communities.set(commId, list);
    }

    let clustersUpserted = 0;

    for (const [commId, entityIds] of communities.entries()) {
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
        : `Topic Group ${commId}`;

      const clusterId = makeClusterId(`cluster_comm_${commId}`);

      // Query articles linked to these entityIds
      const placeholders = entityIds.map(() => '?').join(',');
      const articleRows = await db.prepare(`
        SELECT DISTINCT a.id, a.source, a.published_at, e.evidence
        FROM article_entities ae
        JOIN articles a ON ae.article_id = a.id
        LEFT JOIN extractions e ON a.id = e.article_id
        WHERE ae.entity_id IN (${placeholders})
        ORDER BY a.crawled_at DESC LIMIT 15
      `).bind(...entityIds).all<{
        id: string;
        source: SourceType;
        published_at: number | null;
        evidence: string | null;
      }>();

      let articles = articleRows.results ?? [];

      // Fallback matching by entity names in title/body if article_entities is empty
      if (articles.length === 0 && topEntities.length > 0) {
        const likes = topEntities.map(() => 'a.title LIKE ?').join(' OR ');
        const params = topEntities.map((name) => `%${name}%`);
        const fallbackRows = await db.prepare(`
          SELECT DISTINCT a.id, a.source, a.published_at, e.evidence
          FROM articles a
          LEFT JOIN extractions e ON a.id = e.article_id
          WHERE ${likes}
          ORDER BY a.crawled_at DESC LIMIT 10
        `).bind(...params).all<{
          id: string;
          source: SourceType;
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

      const scoreInput = {
        sources,
        evidenceCount: Math.max(1, evidenceCount),
        claimCount: Math.max(1, articles.length * 2),
        totalEngagement: articles.length * 120,
        publishedAtTimestamps: publishedTimes,
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
    };
  }
}
