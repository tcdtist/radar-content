import { CardStatus } from '../db/types';
import { ClusterScoringInput, ScoreComponents, ScoringEngineConfig } from './scoring-types';

export class ScoringEngine {
  private weightDiversity: number;
  private weightEvidence: number;
  private weightEngagement: number;
  private weightRecency: number;
  private halfLifeHours: number;
  private autoPromoteDiversityThreshold: number;
  private autoPromoteEvidenceThreshold: number;

  constructor(config: ScoringEngineConfig = {}) {
    this.weightDiversity = config.weightDiversity ?? 0.35;
    this.weightEvidence = config.weightEvidence ?? 0.35;
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

    // 2. Evidence density
    const totalClaims = Math.max(1, input.claimCount + input.evidenceCount);
    const evidenceDensity = Math.min(1.0, Math.max(0.1, input.evidenceCount / totalClaims));

    // 3. Community engagement (logarithmic scaling capped at 1000 upvotes/reactions)
    const engagementSignal = Math.min(
      1.0,
      Math.log10(1 + Math.max(0, input.totalEngagement)) / Math.log10(1001)
    );

    // 4. Recency boost (exponential decay)
    const newestTime = input.publishedAtTimestamps.length > 0
      ? Math.max(...input.publishedAtTimestamps)
      : nowSeconds;
    const ageHours = Math.max(0, (nowSeconds - newestTime) / 3600);
    const recencyBoost = Math.exp(-ageHours / this.halfLifeHours);

    // Composite weighted score (0 - 100)
    const rawScore =
      this.weightDiversity * sourceDiversity +
      this.weightEvidence * evidenceDensity +
      this.weightEngagement * engagementSignal +
      this.weightRecency * recencyBoost;

    const finalScore = Math.round(Math.min(100, Math.max(0, rawScore * 100)));

    return {
      sourceDiversity: Math.round(sourceDiversity * 100) / 100,
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
