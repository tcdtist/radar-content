import { CardStatus } from '../db/types';
import { ClusterScoringInput, ScoreComponents, ScoringEngineConfig } from './scoring-types';

export class ScoringEngine {
  private weightDiversity: number;
  private weightAuthority: number;
  private weightEvidence: number;
  private weightEngagement: number;
  private weightRecency: number;
  private halfLifeHours: number;
  private autoPromoteDiversityThreshold: number;
  private autoPromoteEvidenceThreshold: number;

  constructor(config: ScoringEngineConfig = {}) {
    this.weightDiversity = config.weightDiversity ?? 0.20;
    this.weightAuthority = config.weightAuthority ?? 0.20;
    this.weightEvidence = config.weightEvidence ?? 0.30;
    this.weightEngagement = config.weightEngagement ?? 0.15;
    this.weightRecency = config.weightRecency ?? 0.15;
    this.halfLifeHours = config.halfLifeHours ?? 48; // 2-day half life
    this.autoPromoteDiversityThreshold = config.autoPromoteDiversityThreshold ?? 2;
    this.autoPromoteEvidenceThreshold = config.autoPromoteEvidenceThreshold ?? 2;
  }

  computeScore(input: ClusterScoringInput, nowSeconds = Math.floor(Date.now() / 1000)): ScoreComponents {
    // 1. Source diversity (normalized across up to 3 independent platforms)
    const uniqueSources = new Set(input.sources);
    const sourceDiversity = Math.min(1.0, uniqueSources.size / 3);

    // 2. Source authority (identity-based weight, not crowd metrics)
    const sourceAuthority =
      input.sourceWeights && input.sourceWeights.length > 0
        ? input.sourceWeights.reduce((a, b) => a + b, 0) / input.sourceWeights.length
        : sourceDiversity * 0.5; // backward-compatible fallback

    // 3. Evidence density
    const totalClaims = Math.max(1, input.claimCount + input.evidenceCount);
    const evidenceDensity = Math.min(1.0, Math.max(0.1, input.evidenceCount / totalClaims));

    // 4. Community engagement (logarithmic scaling capped at 1000 upvotes/reactions)
    const engagementSignal = Math.min(
      1.0,
      Math.log10(1 + Math.max(0, input.totalEngagement)) / Math.log10(1001)
    );

    // 5. Recency boost (exponential decay)
    const newestTime = input.publishedAtTimestamps.length > 0
      ? Math.max(...input.publishedAtTimestamps)
      : nowSeconds;
    const ageHours = Math.max(0, (nowSeconds - newestTime) / 3600);
    const recencyBoost = Math.exp(-ageHours / this.halfLifeHours);

    // Composite weighted score (0 - 100)
    // Weights: diversity(0.20) + authority(0.20) + evidence(0.30) + engagement(0.15) + recency(0.15) = 1.0
    const rawScore =
      this.weightDiversity * sourceDiversity +
      this.weightAuthority * sourceAuthority +
      this.weightEvidence * evidenceDensity +
      this.weightEngagement * engagementSignal +
      this.weightRecency * recencyBoost;

    const finalScore = Math.round(Math.min(100, Math.max(0, rawScore * 100)));

    return {
      sourceDiversity: Math.round(sourceDiversity * 100) / 100,
      sourceAuthority: Math.round(sourceAuthority * 100) / 100,
      evidenceDensity: Math.round(evidenceDensity * 100) / 100,
      engagementSignal: Math.round(engagementSignal * 100) / 100,
      recencyBoost: Math.round(recencyBoost * 100) / 100,
      finalScore,
    };
  }

  determineStatus(input: ClusterScoringInput, currentStatus: CardStatus = 'LEAD'): CardStatus {
    // If user already took action, keep the user decision
    if (['SAVED', 'WRITTEN', 'DISMISSED'].includes(currentStatus)) {
      return currentStatus;
    }

    // Authority-based auto-promote: ≥ 1 Tier 1 or Tier 2 source (weight ≥ 0.75) + ≥ 2 evidence → READY
    const hasAuthoritySource = input.sourceWeights?.some((w) => w >= 0.75);
    if (hasAuthoritySource && input.evidenceCount >= this.autoPromoteEvidenceThreshold) {
      return 'READY';
    }

    // Legacy diversity-based auto-promote
    const uniqueSources = new Set(input.sources);
    if (
      uniqueSources.size >= this.autoPromoteDiversityThreshold &&
      input.evidenceCount >= this.autoPromoteEvidenceThreshold
    ) {
      return 'READY';
    }

    return 'LEAD';
  }
}
