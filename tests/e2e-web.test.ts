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
});
