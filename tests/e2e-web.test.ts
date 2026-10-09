import { describe, expect, it } from 'vitest';
import { TEST_CARDS } from './fixtures/test-cards';

describe('E2E Web Client & Intelligence Data Logic', () => {
  it('should have valid structured test fixture cards', () => {
    expect(TEST_CARDS.length).toBeGreaterThan(0);
    const card = TEST_CARDS[0];
    expect(card.id).toBeDefined();
    expect(card.label).toBeDefined();
    expect(card.score).toBeGreaterThan(0);
    expect(card.evidence.length).toBeGreaterThan(0);
  });

  it('should filter cards by topic in test fixtures', () => {
    const aiCards = TEST_CARDS.filter((c) =>
      c.topic_tags.some((t) => t.toLowerCase() === 'ai')
    );
    expect(aiCards.length).toBe(1);
    expect(aiCards[0].topic_tags).toContain('AI');

    const dbCards = TEST_CARDS.filter((c) =>
      c.topic_tags.some((t) => t.toLowerCase() === 'database')
    );
    expect(dbCards.length).toBe(1);
    expect(dbCards[0].topic_tags).toContain('Database');
  });

  it('should filter cards by status in test fixtures', () => {
    const readyCards = TEST_CARDS.filter((c) => c.status === 'READY');
    expect(readyCards.length).toBe(2);
  });

  it('should sort cards by score descending in test fixtures', () => {
    const sorted = [...TEST_CARDS].sort((a, b) => b.score - a.score);
    expect(sorted[0].score).toBeGreaterThanOrEqual(sorted[1].score);
  });

  it('should format valid markdown draft with all required sections', () => {
    const card = TEST_CARDS[0];
    const md = `## ${card.label} (Score: ${card.score}/100)
**Status:** ${card.status} | **Topics:** ${card.topic_tags.join(', ')}

### Summary
${card.summary}

### Key Evidence
${card.evidence.map((e) => `- ${e}`).join('\n')}

### Counterarguments & Limitations
${card.counter.map((c) => `- ${c}`).join('\n')}

### Verification Checklist
${card.verification_questions.map((q) => `- [ ] ${q}`).join('\n')}

### Sources
${card.sources.map((s) => `- [${s.source.toUpperCase()}] ${s.title}: ${s.url}`).join('\n')}`;

    expect(md).toContain(`## ${card.label}`);
    expect(md).toContain('### Summary');
    expect(md).toContain('### Key Evidence');
    expect(md).toContain('### Counterarguments & Limitations');
    expect(md).toContain('### Verification Checklist');
    expect(md).toContain('### Sources');
  });

  it('should filter cards by source tier (T1, T2, T3)', async () => {
    const { getHighestTierBadge } = await import('../src/pages/utils/tier-badge');
    const { SourceTier } = await import('../src/lib/scoring/source-tiers');

    const t1Card = { ...TEST_CARDS[0], sources: [{ source: 'x' as const, title: 'X post', url: 'https://x.com/karpathy/status/123' }] };
    const t2Card = { ...TEST_CARDS[0], sources: [{ source: 'hn' as const, title: 'HN post', url: 'https://news.ycombinator.com/item?id=123' }] };
    const t3Card = { ...TEST_CARDS[0], sources: [{ source: 'reddit' as const, title: 'Reddit post', url: 'https://reddit.com/r/localllama/123' }] };

    const cards = [t1Card, t2Card, t3Card];

    expect(getHighestTierBadge(t1Card.sources).tier).toBe(SourceTier.T1_AUTHORITY);
    expect(getHighestTierBadge(t2Card.sources).tier).toBe(SourceTier.T2_DEPTH);
    expect(getHighestTierBadge(t3Card.sources).tier).toBe(SourceTier.T3_REFERENCE);

    const filterByTier = (tier: string) => {
      if (tier === 'all') return cards;
      const targetTier =
        tier === 'T1'
          ? SourceTier.T1_AUTHORITY
          : tier === 'T2'
            ? SourceTier.T2_DEPTH
            : SourceTier.T3_REFERENCE;
      return cards.filter((c) => getHighestTierBadge(c.sources).tier === targetTier);
    };

    expect(filterByTier('all').length).toBe(3);
    expect(filterByTier('T1').length).toBe(1);
    expect(filterByTier('T2').length).toBe(1);
    expect(filterByTier('T3').length).toBe(1);
  });
});

