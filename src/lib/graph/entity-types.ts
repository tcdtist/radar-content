import { EntityId, EntityType } from '../db/types';

export interface GraphNode {
  id: EntityId;
  name: string;
  type: EntityType;
  weight: number;
}

export interface GraphEdge {
  source: EntityId;
  target: EntityId;
  weight: number;
}

export interface EntityCoOccurrence {
  entityA: string;
  entityB: string;
  typeA: EntityType;
  typeB: EntityType;
}
