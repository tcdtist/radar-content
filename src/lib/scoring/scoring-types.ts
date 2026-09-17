import { SourceType } from '../db/types';

export interface ScoreComponents {
  sourceDiversity: number; // 0 to 1
  evidenceDensity: number; // 0 to 1
  engagementSignal: number; // 0 to 1
  recencyBoost: number; // 0 to 1
  finalScore: number; // 0 to 100
}

export interface ClusterScoringInput {
  sources: SourceType[];
  evidenceCount: number;
  claimCount: number;
  totalEngagement: number;
  publishedAtTimestamps: number[];
}

export interface ScoringEngineConfig {
  weightDiversity?: number;
  weightEvidence?: number;
  weightEngagement?: number;
  weightRecency?: number;
  halfLifeHours?: number;
  autoPromoteDiversityThreshold?: number;
  autoPromoteEvidenceThreshold?: number;
}
