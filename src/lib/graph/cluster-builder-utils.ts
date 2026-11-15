import { migrateTranslations } from '../db/translation-queries';
import { ClusterId, makeClusterId, SourceType } from '../db/types';

/**
 * Helper utilities for cluster label derivation, tags, and stable ID hashing.
 */

export function deriveStableClusterId(entityIds: string[], suffix?: string): string {
  const sorted = [...entityIds].sort();
  const key = sorted.join('|');
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const ch = key.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  const base = `cluster_${Math.abs(hash).toString(36)}`;
  return suffix ? `${base}_${suffix}` : base;
}

export function deriveClusterLabel(topEntities: string[]): string {
  const formatTitle = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  if (topEntities.length === 0) return 'Topic Group';
  if (topEntities.length === 1) return formatTitle(topEntities[0]);
  return `${formatTitle(topEntities[0])} · ${topEntities.slice(1, 3).join(', ')}`;
}

export function normalizeClusterLabelKey(label: string): string {
  return label
    .toLowerCase()
    .split(/[·,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
    .join('|');
}

export function determineClusterTags(label: string, topEntities: string[]): string[] {
  const text = `${label} ${topEntities.join(' ')}`.toLowerCase();
  const tags: string[] = ['AI'];
  if (text.includes('system') || text.includes('model') || text.includes('route') || text.includes('bench')) {
    tags.push('System Design');
  }
  if (text.includes('api') || text.includes('backend') || text.includes('database') || text.includes('provider')) {
    tags.push('Backend');
  }
  if (text.includes('frontend') || text.includes('ui') || text.includes('css') || text.includes('react')) {
    tags.push('Frontend');
  }
  if (text.includes('security') || text.includes('cve') || text.includes('auth') || text.includes('token')) {
    tags.push('Security');
  }
  return Array.from(new Set(tags));
}

export interface RawClusterArticleRow {
  id: string;
  source: SourceType;
  url: string;
  published_at: number | null;
  crawled_at: number;
  evidence: string | null;
}

export async function queryCommunityArticles(
  db: D1Database,
  queryEntityIds: string[],
  topEntities: string[],
  activeCutoff: number
): Promise<RawClusterArticleRow[]> {
  const placeholders = queryEntityIds.map(() => '?').join(',');
  const articleRows = await db.prepare(`
    SELECT DISTINCT a.id, a.source, a.url, a.published_at, a.crawled_at, e.evidence
    FROM article_entities ae
    JOIN articles a ON ae.article_id = a.id
    LEFT JOIN extractions e ON e.id = (
      SELECT e2.id FROM extractions e2 WHERE e2.article_id = a.id ORDER BY e2.extracted_at DESC LIMIT 1
    )
    WHERE ae.entity_id IN (${placeholders})
      AND (a.crawled_at >= ? OR a.published_at >= ?)
    ORDER BY a.crawled_at DESC LIMIT 15
  `).bind(...queryEntityIds, activeCutoff, activeCutoff).all<RawClusterArticleRow>();

  let articles = articleRows.results ?? [];

  if (articles.length === 0 && topEntities.length > 0) {
    const likes = topEntities.map(() => 'a.title LIKE ?').join(' OR ');
    const params = topEntities.map((name) => `%${name}%`);
    const fallbackRows = await db.prepare(`
      SELECT DISTINCT a.id, a.source, a.url, a.published_at, a.crawled_at, e.evidence
      FROM articles a
      LEFT JOIN extractions e ON e.id = (
        SELECT e2.id FROM extractions e2 WHERE e2.article_id = a.id ORDER BY e2.extracted_at DESC LIMIT 1
      )
      WHERE (${likes})
        AND (a.crawled_at >= ? OR a.published_at >= ?)
      ORDER BY a.crawled_at DESC LIMIT 10
    `).bind(...params, activeCutoff, activeCutoff).all<RawClusterArticleRow>();
    articles = fallbackRows.results ?? [];
  }

  return articles;
}

export async function consolidateDuplicateClusters(
  db: D1Database,
  label: string,
  clusterId: ClusterId
): Promise<number> {
  let translationsMigrated = 0;
  const targetKey = normalizeClusterLabelKey(label);

  const activeRows = await db.prepare(
    `SELECT id, label FROM clusters WHERE id != ? AND status != 'SEALED'`
  ).bind(clusterId).all<{ id: string; label: string }>();

  const duplicateRows = (activeRows.results ?? []).filter(
    (row) => row.label === label || (targetKey && normalizeClusterLabelKey(row.label) === targetKey)
  );

  for (const dup of duplicateRows) {
    const migrated = await migrateTranslations(db, makeClusterId(dup.id), clusterId);
    if (migrated) translationsMigrated++;
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO notified_clusters (cluster_id)
         SELECT ? FROM notified_clusters WHERE cluster_id = ?`
      ).bind(clusterId, dup.id).run();
    } catch {}
    await db.prepare('DELETE FROM cluster_articles WHERE cluster_id = ?').bind(dup.id).run();
    await db.prepare('DELETE FROM clusters WHERE id = ?').bind(dup.id).run();
  }

  return translationsMigrated;
}

