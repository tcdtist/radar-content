import { EntityId, EntityType, makeEntityId } from '../db/types';
import { GraphEdge, GraphNode } from './entity-types';

/**
 * Upsert an entity and return its EntityId.
 */
export async function upsertEntity(
  db: D1Database,
  name: string,
  type: EntityType
): Promise<EntityId> {
  const normalizedName = name.trim().toLowerCase();
  const id = makeEntityId(`ent_${normalizedName.replace(/[^a-z0-9_-]/g, '_')}`);
  const now = Math.floor(Date.now() / 1000);

  await db.prepare(`
    INSERT INTO entities (id, name, type, first_seen, article_count)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(name) DO UPDATE SET
      article_count = article_count + 1
  `).bind(id, normalizedName, type, now).run();

  const record = await db.prepare('SELECT id FROM entities WHERE name = ?')
    .bind(normalizedName)
    .first<{ id: string }>();

  return makeEntityId(record?.id ?? id);
}

/**
 * Upsert an undirected co-occurrence edge between two entities.
 */
export async function upsertEdge(
  db: D1Database,
  sourceId: EntityId,
  targetId: EntityId,
  weightIncrement = 1.0
): Promise<void> {
  // Ensure consistent ordering to avoid duplicate reverse edges (A, B) vs (B, A)
  const [src, tgt] = sourceId < targetId ? [sourceId, targetId] : [targetId, sourceId];

  await db.prepare(`
    INSERT INTO edges (source_entity, target_entity, weight)
    VALUES (?, ?, ?)
    ON CONFLICT(source_entity, target_entity) DO UPDATE SET
      weight = weight + ?
  `).bind(src, tgt, weightIncrement, weightIncrement).run();
}

/**
 * Link an article with an entity in article_entities.
 */
export async function linkArticleEntity(
  db: D1Database,
  articleId: string,
  entityId: EntityId
): Promise<void> {
  await db.prepare(`
    INSERT INTO article_entities (article_id, entity_id)
    VALUES (?, ?)
    ON CONFLICT(article_id, entity_id) DO NOTHING
  `).bind(articleId, entityId).run();
}

/**
 * Fetch all nodes and edges from D1 for graph clustering.
 */
export async function fetchGraph(
  db: D1Database
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const nodesQuery = await db.prepare('SELECT id, name, type, article_count as weight FROM entities').all<GraphNode>();
  const edgesQuery = await db.prepare('SELECT source_entity as source, target_entity as target, weight FROM edges').all<GraphEdge>();

  const nodes = (nodesQuery.results ?? []).map((n) => ({
    ...n,
    id: makeEntityId(n.id as unknown as string),
  }));

  const edges = (edgesQuery.results ?? []).map((e) => ({
    source: makeEntityId(e.source as unknown as string),
    target: makeEntityId(e.target as unknown as string),
    weight: e.weight || 1.0,
  }));

  return { nodes, edges };
}
