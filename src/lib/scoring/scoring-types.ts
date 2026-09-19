import { SourceType } from '../db/types';

export interface ScoreComponents {
  sourceDiversity: number; // 0 to 1
  sourceAuthority: number; // 0 to 1 (identity-based weight)
  evidenceDensity: number; // 0 to 1
  engagementSignal: number; // 0 to 1
  recencyBoost: number; // 0 to 1
  finalScore: number; // 0 to 100
}

export interface ClusterScoringInput {
  sources: SourceType[];
  sourceWeights?: number[]; // authority weights per source (0–1)
  evidenceCount: number;
  claimCount: number;
  totalEngagement: number;
  publishedAtTimestamps: number[];
}

export interface ScoringEngineConfig {
  weightDiversity?: number;
  weightAuthority?: number;
  weightEvidence?: number;
  weightEngagement?: number;
  weightRecency?: number;
  halfLifeHours?: number;
  autoPromoteDiversityThreshold?: number;
  autoPromoteEvidenceThreshold?: number;
}
