import { ScoredIntelligenceCard } from '../db/types';
import { MOCK_AI_CARDS } from './mock-cards-ai';
import { MOCK_FRONTEND_CARDS } from './mock-cards-frontend';
import { MOCK_SYSTEM_CARDS } from './mock-cards-system';

export { MOCK_AI_CARDS } from './mock-cards-ai';
export { MOCK_FRONTEND_CARDS } from './mock-cards-frontend';
export { MOCK_SYSTEM_CARDS } from './mock-cards-system';

/**
 * Combined Curated Mock Intelligence Cards for Guest Preview.
 * Strictly deduplicated by card ID and sorted by score descending.
 */
const rawMockCards: ScoredIntelligenceCard[] = [
  ...MOCK_AI_CARDS,
  ...MOCK_SYSTEM_CARDS,
  ...MOCK_FRONTEND_CARDS,
];

const uniqueCardsMap = new Map<string, ScoredIntelligenceCard>();
for (const card of rawMockCards) {
  if (!uniqueCardsMap.has(card.id)) {
    uniqueCardsMap.set(card.id, card);
  }
}

export const MOCK_INTELLIGENCE_CARDS: ScoredIntelligenceCard[] = Array.from(
  uniqueCardsMap.values()
).sort((a, b) => b.score - a.score);
