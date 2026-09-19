import { useMemo, useState } from 'react';
import { ScoredIntelligenceCard } from '../../lib/db/types';
import { getSourceTier, SourceTier } from '../../lib/scoring/source-tiers';

// Rolling 30-day cutoff for active signals (SAVED and WRITTEN cards are immune)
const ROLLING_WINDOW_SECONDS = 30 * 86400;

interface UseFilteredCardsParams {
  cards: ScoredIntelligenceCard[];
}

export function useFilteredCards({ cards }: UseFilteredCardsParams) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTierFilter, setActiveTierFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const resetFilters = () => {
    setSearchQuery('');
    setActiveTierFilter('all');
    setCurrentPage(1);
  };

  const filteredCards = useMemo(() => {
    const rollingCutoff = Math.floor(Date.now() / 1000) - ROLLING_WINDOW_SECONDS;
    let result = cards.filter(
      (c) =>
        c.id.startsWith('clu_mock_') ||
        c.status === 'SAVED' ||
        c.status === 'WRITTEN' ||
        c.created_at >= rollingCutoff ||
        Boolean(c.sources?.some((s) => (s.published_at || 0) >= rollingCutoff))
    );

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.summary.toLowerCase().includes(q) ||
          c.topic_tags.some((t) => t.toLowerCase().includes(q)) ||
          c.evidence.some((e) => e.toLowerCase().includes(q))
      );
    }

    // Tier filter: check if card has ≥ 1 source matching selected tier(s)
    if (activeTierFilter !== 'all') {
      const allowedTiers: SourceTier[] =
        activeTierFilter === 'T1'
          ? [SourceTier.T1_AUTHORITY]
          : [SourceTier.T1_AUTHORITY, SourceTier.T2_DEPTH];
      result = result.filter((c) =>
        c.sources?.some((s) => allowedTiers.includes(getSourceTier(s.source, s.url).tier))
      );
    }

    return result;
  }, [cards, searchQuery, activeTierFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));

  const paginatedCards = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredCards.slice(startIndex, startIndex + pageSize);
  }, [filteredCards, currentPage, pageSize]);

  return {
    searchQuery,
    setSearchQuery,
    activeTierFilter,
    setActiveTierFilter,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    resetFilters,
    filteredCards,
    paginatedCards,
    totalPages,
  };
}
