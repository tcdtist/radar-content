import { EntityId } from '../db/types';
import { ExtractedEntity } from '../llm/llm-types';
import { linkArticleEntity, upsertEntity } from './graph-queries';

export class EntityBuilder {
  /**
   * Process extracted entities for an article:
   * 1. Upsert entities into D1
   * 2. Link entity to article in article_entities
   * 3. Build pairwise co-occurrence edges (batched to respect Cloudflare subrequest limit)
   */
  async processArticleEntities(
    db: D1Database,
    entities: ExtractedEntity[],
    articleId?: string
  ): Promise<EntityId[]> {
    if (!entities || entities.length === 0) {
      return [];
    }

    // Deduplicate entities by name and cap to top 6 core entities per article
    const uniqueMap = new Map<string, ExtractedEntity>();
    for (const ent of entities) {
      const key = ent.name.trim().toLowerCase();
      if (key.length > 1 && !uniqueMap.has(key)) {
        uniqueMap.set(key, ent);
      }
    }

    const uniqueEntities = Array.from(uniqueMap.values()).slice(0, 6);
    const entityIds: EntityId[] = [];

    // 1. Upsert individual entities and link to article
    for (const ent of uniqueEntities) {
      try {
        const id = await upsertEntity(db, ent.name, ent.type);
        entityIds.push(id);
        if (articleId) {
          await linkArticleEntity(db, articleId, id);
        }
      } catch (err) {
        console.error(`Error upserting entity ${ent.name}:`, err);
      }
    }

    // 2. Build pair-wise co-occurrence edges (batched in 1 subrequest)
    const edgeStatements: D1PreparedStatement[] = [];
    for (let i = 0; i < entityIds.length; i++) {
      for (let j = i + 1; j < entityIds.length; j++) {
        const [src, tgt] = entityIds[i] < entityIds[j] ? [entityIds[i], entityIds[j]] : [entityIds[j], entityIds[i]];
        edgeStatements.push(
          db.prepare(`
            INSERT INTO edges (source_entity, target_entity, weight)
            VALUES (?, ?, ?)
            ON CONFLICT(source_entity, target_entity) DO UPDATE SET
              weight = weight + ?
          `).bind(src, tgt, 1.0, 1.0)
        );
      }
    }

    if (edgeStatements.length > 0) {
      try {
        if (typeof db.batch === 'function') {
          await db.batch(edgeStatements);
        } else {
          for (const stmt of edgeStatements) {
            await stmt.run();
          }
        }
      } catch (err) {
        console.error('Error batch updating edges:', err);
      }
    }

    return entityIds;
  }
}
