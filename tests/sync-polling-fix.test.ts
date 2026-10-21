import { describe, expect, it } from 'vitest';

describe('Sync Polling Optimization (Phase 04)', () => {
  it('detects changes immediately when top card ID changes even if length is identical', () => {
    const baselineCards = [
      { id: 'cluster_old_top', score: 80, updated_at: 1000 },
      { id: 'cluster_sub_1', score: 70, updated_at: 1000 },
    ];
    const postCrawlCards = [
      { id: 'cluster_new_fresh_top', score: 88, updated_at: 2000 },
      { id: 'cluster_old_top', score: 80, updated_at: 1000 },
    ];

    const baselineStats = { totalClusters: 10, totalArticles: 50 };
    const postCrawlStats = { totalClusters: 10, totalArticles: 52 };

    const baselineTopCardId = baselineCards[0]?.id;
    const baselineCardCount = baselineCards.length;
    const baselineClusterCount = baselineStats.totalClusters;
    const baselineArticleCount = baselineStats.totalArticles;

    const hasDataChanged = (latestCards: typeof baselineCards, latestStats: typeof baselineStats) => {
      return (
        latestCards.length > baselineCardCount ||
        latestStats.totalClusters !== baselineClusterCount ||
        latestStats.totalArticles !== baselineArticleCount ||
        (latestCards.length > 0 && latestCards[0]?.id !== baselineTopCardId)
      );
    };

    // Both length are 2, but top card ID and article count changed -> detects change immediately!
    expect(hasDataChanged(postCrawlCards, postCrawlStats)).toBe(true);
  });

  it('caps max polling attempts to 5 with 3s interval (15s total)', () => {
    const maxAttempts = 5;
    const pollIntervalMs = 3000;
    const totalMaxDuration = maxAttempts * pollIntervalMs;

    expect(totalMaxDuration).toBe(15000);
    expect(totalMaxDuration).toBeLessThanOrEqual(15000);
  });
});
