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
});
