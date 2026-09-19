import { ScoredIntelligenceCard } from '../db/types';
import { MOCK_AI_CARDS } from './mock-cards-ai';
import { MOCK_FRONTEND_CARDS } from './mock-cards-frontend';
import { MOCK_SYSTEM_CARDS } from './mock-cards-system';

export { MOCK_AI_CARDS } from './mock-cards-ai';
export { MOCK_FRONTEND_CARDS } from './mock-cards-frontend';
export { MOCK_SYSTEM_CARDS } from './mock-cards-system';

/**
 * Combined 12 Curated Mock Intelligence Cards for Guest Preview.
 * Strictly sorted by score descending (98 -> 92).
 */
export const MOCK_INTELLIGENCE_CARDS: ScoredIntelligenceCard[] = [
  ...MOCK_AI_CARDS,
  ...MOCK_SYSTEM_CARDS,
  ...MOCK_FRONTEND_CARDS,
].sort((a, b) => b.score - a.score);
