import { EntityId } from '../db/types';
import { ExtractedEntity } from '../llm/llm-types';
import { linkArticleEntity, upsertEdge, upsertEntity } from './graph-queries';

export class EntityBuilder {
  /**
   * Process extracted entities for an article:
   * 1. Upsert entities into D1
   * 2. Link entity to article in article_entities
   * 3. Build pairwise co-occurrence edges
   */
  async processArticleEntities(
    db: D1Database,
    entities: ExtractedEntity[],
    articleId?: string
  ): Promise<EntityId[]> {
    if (!entities || entities.length === 0) {
      return [];
    }

    // Deduplicate entities by name
    const uniqueMap = new Map<string, ExtractedEntity>();
    for (const ent of entities) {
      const key = ent.name.trim().toLowerCase();
      if (key.length > 1 && !uniqueMap.has(key)) {
        uniqueMap.set(key, ent);
      }
    }

    const uniqueEntities = Array.from(uniqueMap.values());
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

    // 2. Build pair-wise co-occurrence edges
    for (let i = 0; i < entityIds.length; i++) {
      for (let j = i + 1; j < entityIds.length; j++) {
        try {
          await upsertEdge(db, entityIds[i], entityIds[j], 1.0);
        } catch (err) {
          console.error(`Error updating edge (${entityIds[i]}, ${entityIds[j]}):`, err);
        }
      }
    }

    return entityIds;
  }
}
