import { SourceType } from '../db/types';

export interface RawSourcePost {
  source: SourceType;
  sourceId: string;
  url: string;
  title: string;
  body: string | null;
  author: string | null;
  publishedAt: number | null;
  engagementScore: number;
  commentsCount: number;
}

export interface SourceCrawler {
  readonly name: string;
  readonly sourceType: SourceType;
  fetchLatest(limit?: number): Promise<RawSourcePost[]>;
}
