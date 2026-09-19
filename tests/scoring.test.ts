import { describe, expect, it } from 'vitest';
import { SourceType } from '../src/lib/db/types';
import { ScoringEngine } from '../src/lib/scoring/scoring-engine';

describe('ScoringEngine', () => {
  const engine = new ScoringEngine();

  it('calculates higher score for multi-source evidence-heavy topics', () => {
    const highQualitySources: SourceType[] = ['reddit', 'hn', 'rss'];
    const highQualityInput = {
      sources: highQualitySources,
      evidenceCount: 6,
      claimCount: 4,
      totalEngagement: 850,
      publishedAtTimestamps: [Math.floor(Date.now() / 1000) - 3600], // 1 hour ago
    };

    const lowQualitySources: SourceType[] = ['reddit'];
    const lowQualityInput = {
      sources: lowQualitySources,
      evidenceCount: 0,
      claimCount: 5,
      totalEngagement: 10,
      publishedAtTimestamps: [Math.floor(Date.now() / 1000) - 7 * 86400], // 7 days ago
    };

    const highComp = engine.computeScore(highQualityInput);
    const lowComp = engine.computeScore(lowQualityInput);

    expect(highComp.finalScore).toBeGreaterThan(lowComp.finalScore);
    expect(highComp.sourceDiversity).toBe(1.0); // 3 unique sources
    expect(lowComp.sourceDiversity).toBeCloseTo(0.33, 1);
  });

  it('auto-promotes LEAD to READY when diversity and evidence thresholds are met', () => {
    const readySources: SourceType[] = ['reddit', 'hn'];
    const readyInput = {
      sources: readySources,
      evidenceCount: 3,
      claimCount: 2,
      totalEngagement: 200,
      publishedAtTimestamps: [],
    };

    const leadSources: SourceType[] = ['reddit'];
    const leadInput = {
      sources: leadSources,
      evidenceCount: 1,
      claimCount: 2,
      totalEngagement: 50,
      publishedAtTimestamps: [],
    };

    expect(engine.determineStatus(readyInput, 'LEAD')).toBe('READY');
    expect(engine.determineStatus(leadInput, 'LEAD')).toBe('LEAD');
  });

  it('preserves user status if already SAVED or WRITTEN', () => {
    const leadSources: SourceType[] = ['reddit'];
    const leadInput = {
      sources: leadSources,
      evidenceCount: 0,
      claimCount: 5,
      totalEngagement: 0,
      publishedAtTimestamps: [],
    };

    expect(engine.determineStatus(leadInput, 'SAVED')).toBe('SAVED');
    expect(engine.determineStatus(leadInput, 'WRITTEN')).toBe('WRITTEN');
    expect(engine.determineStatus(leadInput, 'DISMISSED')).toBe('DISMISSED');
  });

  it('scores higher with T1 authority sources than T3-only sources', () => {
    const now = Math.floor(Date.now() / 1000);
    const t1Input = {
      sources: ['x', 'hn'] as SourceType[],
      sourceWeights: [1.0, 0.75], // T1 + T2
      evidenceCount: 3,
      claimCount: 2,
      totalEngagement: 200,
      publishedAtTimestamps: [now - 3600],
    };

    const t3Input = {
      sources: ['reddit', 'rss'] as SourceType[],
      sourceWeights: [0.4, 0.4], // T3 + T3
      evidenceCount: 3,
      claimCount: 2,
      totalEngagement: 200,
      publishedAtTimestamps: [now - 3600],
    };

    const t1Score = engine.computeScore(t1Input);
    const t3Score = engine.computeScore(t3Input);

    expect(t1Score.sourceAuthority).toBeGreaterThan(t3Score.sourceAuthority);
    expect(t1Score.finalScore).toBeGreaterThan(t3Score.finalScore);
  });

  it('auto-promotes to READY with authority source + evidence', () => {
    const input = {
      sources: ['x'] as SourceType[],
      sourceWeights: [1.0], // T1 authority
      evidenceCount: 2,
      claimCount: 2,
      totalEngagement: 50,
      publishedAtTimestamps: [],
    };

    // Single source but T1 authority + evidence → READY
    expect(engine.determineStatus(input, 'LEAD')).toBe('READY');
  });

  it('backward compatible when sourceWeights is undefined', () => {
    const input = {
      sources: ['hn', 'reddit'] as SourceType[],
      evidenceCount: 3,
      claimCount: 2,
      totalEngagement: 200,
      publishedAtTimestamps: [Math.floor(Date.now() / 1000)],
    };

    const score = engine.computeScore(input);
    expect(score.finalScore).toBeGreaterThanOrEqual(0);
    expect(score.finalScore).toBeLessThanOrEqual(100);
    expect(score.sourceAuthority).toBeGreaterThanOrEqual(0);
  });

  it('returns sourceAuthority in ScoreComponents', () => {
    const input = {
      sources: ['x'] as SourceType[],
      sourceWeights: [1.0],
      evidenceCount: 2,
      claimCount: 2,
      totalEngagement: 100,
      publishedAtTimestamps: [Math.floor(Date.now() / 1000)],
    };

    const score = engine.computeScore(input);
    expect(score).toHaveProperty('sourceAuthority');
    expect(score.sourceAuthority).toBe(1.0);
  });
});

