import { describe, expect, it } from 'vitest';
import { getCardFreshnessInfo } from '../src/pages/utils/card-freshness';

describe('Card Freshness Temporal Logic & Badges (getCardFreshnessInfo)', () => {
  const fixedNow = 1710000000; // Fixed timestamp in seconds (2024-03-09 16:00:00 UTC)

  it('assigns NEW badge to cards created within 48 hours', () => {
    const createdAt = fixedNow - 12 * 3600; // 12 hours ago
    const card = {
      created_at: createdAt,
      sources: [{ published_at: createdAt }],
    };

    const info = getCardFreshnessInfo(card, fixedNow);

    expect(info.isNewlyEmerged).toBe(true);
    expect(info.hasFreshSourceUpdate).toBe(false);
    expect(info.badge).toBe('NEW');
    expect(info.relativeTimeText).toBe('12h ago');
    expect(info.tooltipText).toContain('Emerged:');
    expect(info.tooltipText).not.toContain('First emerged:');
  });

  it('assigns NEW badge to cards at boundary of 48 hours', () => {
    const createdAt = fixedNow - 48 * 3600; // exactly 48 hours ago
    const card = {
      created_at: createdAt,
      sources: [{ published_at: createdAt }],
    };

    const info = getCardFreshnessInfo(card, fixedNow);
    expect(info.isNewlyEmerged).toBe(true);
    expect(info.badge).toBe('NEW');
  });

  it('assigns UPDATED badge to older cards (>48h) with fresh sources within 72h', () => {
    const createdAt = fixedNow - 20 * 86400; // 20 days ago
    const latestSource = fixedNow - 2 * 3600; // 2 hours ago
    const card = {
      created_at: createdAt,
      sources: [
        { published_at: createdAt },
        { published_at: latestSource },
      ],
    };

    const info = getCardFreshnessInfo(card, fixedNow);

    expect(info.isNewlyEmerged).toBe(false);
    expect(info.hasFreshSourceUpdate).toBe(true);
    expect(info.badge).toBe('UPDATED');
    expect(info.relativeTimeText).toBe('20d ago (upd 2h ago)');
    expect(info.tooltipText).toContain('First emerged:');
    expect(info.tooltipText).toContain('Latest source:');
  });

  it('assigns no badge to older cards when fresh sources are older than 72 hours', () => {
    const createdAt = fixedNow - 30 * 86400; // 30 days ago
    const latestSource = fixedNow - 5 * 86400; // 5 days ago (120h > 72h)
    const card = {
      created_at: createdAt,
      sources: [
        { published_at: createdAt },
        { published_at: latestSource },
      ],
    };

    const info = getCardFreshnessInfo(card, fixedNow);

    expect(info.isNewlyEmerged).toBe(false);
    expect(info.hasFreshSourceUpdate).toBe(false);
    expect(info.badge).toBeNull();
    expect(info.relativeTimeText).toBe('1mo ago');
    expect(info.tooltipText).toContain('Emerged:');
  });

  it('prefers NEW badge over UPDATED if card is newly emerged even with newer sources', () => {
    const createdAt = fixedNow - 24 * 3600; // 24 hours ago (newly emerged)
    const latestSource = fixedNow - 2 * 3600; // 2 hours ago
    const card = {
      created_at: createdAt,
      sources: [{ published_at: latestSource }],
    };

    const info = getCardFreshnessInfo(card, fixedNow);

    expect(info.isNewlyEmerged).toBe(true);
    expect(info.badge).toBe('NEW');
  });

  it('handles missing or empty sources and timestamps gracefully', () => {
    const cardWithoutSources = {
      created_at: fixedNow - 3600,
    };

    const info = getCardFreshnessInfo(cardWithoutSources, fixedNow);
    expect(info.isNewlyEmerged).toBe(true);
    expect(info.badge).toBe('NEW');
    expect(info.relativeTimeText).toBe('1h ago');

    const cardWithoutDates = {};
    const infoEmpty = getCardFreshnessInfo(cardWithoutDates, fixedNow);
    expect(infoEmpty.isNewlyEmerged).toBe(true); // age 0
    expect(infoEmpty.badge).toBe('NEW');
    expect(infoEmpty.relativeTimeText).toBe('Unknown');
  });
});
