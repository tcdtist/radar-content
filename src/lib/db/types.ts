/**
 * Database type definitions and branded IDs for Radar Content.
 */

export type ArticleId = string & { readonly __brand: unique symbol };
export type ExtractionId = string & { readonly __brand: unique symbol };
export type EntityId = string & { readonly __brand: unique symbol };
export type ClusterId = string & { readonly __brand: unique symbol };

export const makeArticleId = (id: string): ArticleId => id as ArticleId;
export const makeExtractionId = (id: string): ExtractionId => id as ExtractionId;
export const makeEntityId = (id: string): EntityId => id as EntityId;
export const makeClusterId = (id: string): ClusterId => id as ClusterId;

export type SourceType = 'reddit' | 'hn' | 'x' | 'rss' | 'lobsters';
export type CardStatus = 'LEAD' | 'READY' | 'SAVED' | 'WRITTEN' | 'DISMISSED';
export type EntityType = 'technology' | 'person' | 'company';

export interface ArticleRecord {
  id: ArticleId;
  source: SourceType;
  source_id: string;
  url: string;
  title: string;
  body: string | null;
  author: string | null;
  published_at: number | null;
  crawled_at: number;
  processed: number;
}

export interface ExtractionRecord {
  id: ExtractionId;
  article_id: ArticleId;
  summary: string;
  evidence: string; // JSON string array
  counter: string; // JSON string array
  context: string; // JSON string array
  verification_questions: string; // JSON string array
  extracted_at: number;
}

export interface EntityRecord {
  id: EntityId;
  name: string;
  type: EntityType;
  first_seen: number;
  article_count: number;
}

export interface EdgeRecord {
  source_entity: EntityId;
  target_entity: EntityId;
  weight: number;
}

export interface ClusterRecord {
  id: ClusterId;
  label: string | null;
  topic_tags: string; // JSON array of string tags
  score: number;
  status: CardStatus;
  article_count: number;
  source_count: number;
  created_at: number;
  updated_at: number;
}

export interface ClusterArticleRecord {
  cluster_id: ClusterId;
  article_id: ArticleId;
}

export interface ScoredIntelligenceCard {
  id: ClusterId;
  label: string;
  topic_tags: string[];
  score: number;
  status: CardStatus;
  article_count: number;
  source_count: number;
  created_at: number;
  updated_at: number;
  summary: string;
  evidence: string[];
  counter: string[];
  context: string[];
  verification_questions: string[];
  entities: Array<{ name: string; type: EntityType } | string>;
  sources: Array<{
    title: string;
    url: string;
    source: SourceType;
    author: string | null;
    published_at: number | null;
    crawled_at?: number | null;
  }>;
}

export interface CardTranslation {
  card_id: ClusterId;
  lang: string;
  summary: string;
  evidence: string[];
  counter: string[];
  context: string[];
  verification_questions: string[];
  translated_at: number;
}

