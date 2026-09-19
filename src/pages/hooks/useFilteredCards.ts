import { useMemo, useState } from 'react';
import { ScoredIntelligenceCard } from '../../lib/db/types';

// Rolling 30-day cutoff for active signals (SAVED and WRITTEN cards are immune)
const ROLLING_WINDOW_SECONDS = 30 * 86400;

interface UseFilteredCardsParams {
  cards: ScoredIntelligenceCard[];
}

export function useFilteredCards({ cards }: UseFilteredCardsParams) {
  const [activeTopic, setActiveTopic] = useState('all');
  const [activeStatus, setActiveStatus] = useState('READY,LEAD');
  const [activeSort, setActiveSort] = useState('score');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const resetFilters = () => {
    setActiveTopic('all');
    setActiveStatus('READY,LEAD');
    setSearchQuery('');
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

    return result;
  }, [cards, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));

  const paginatedCards = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredCards.slice(startIndex, startIndex + pageSize);
  }, [filteredCards, currentPage, pageSize]);

  return {
    activeTopic,
    setActiveTopic,
    activeStatus,
    setActiveStatus,
    activeSort,
    setActiveSort,
    searchQuery,
    setSearchQuery,
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
