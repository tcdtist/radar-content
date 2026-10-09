import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScoredIntelligenceCard } from '../../lib/db/types';
import { SourceTier } from '../../lib/scoring/source-tiers';
import { getHighestTierBadge } from '../utils/tier-badge';

// Rolling 30-day cutoff for active signals (SAVED and WRITTEN cards are immune)
const ROLLING_WINDOW_SECONDS = 30 * 86400;

interface UseFilteredCardsParams {
  cards: ScoredIntelligenceCard[];
  initialPage?: number;
  currentPage?: number;
  onPageChange?: (page: number, replace?: boolean) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  isLoading?: boolean;
}

export function useFilteredCards({
  cards,
  initialPage = 1,
  currentPage: externalPage,
  onPageChange,
  pageSize: externalPageSize,
  onPageSizeChange,
  searchQuery: externalSearchQuery,
  onSearchChange,
  isLoading = false,
}: UseFilteredCardsParams) {
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [activeTierFilter, setActiveTierFilter] = useState('all');
  const [internalPage, setInternalPage] = useState(initialPage);
  const [internalPageSize, setInternalPageSize] = useState(6);

  const currentPage = externalPage ?? internalPage;
  const pageSize = externalPageSize ?? internalPageSize;
  const setPageSize = onPageSizeChange ?? setInternalPageSize;
  const searchQuery = externalSearchQuery ?? internalSearchQuery;

  const setPage = useCallback(
    (page: number, replace = false) => {
      if (onPageChange) {
        onPageChange(page, replace);
      } else {
        setInternalPage(page);
      }
    },
    [onPageChange]
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      if (onSearchChange) {
        onSearchChange(query);
      } else {
        setInternalSearchQuery(query);
        setPage(1, true);
      }
    },
    [onSearchChange, setPage]
  );

  const handleTierFilterChange = useCallback(
    (tier: string) => {
      setActiveTierFilter(tier);
      setPage(1, true);
    },
    [setPage]
  );

  const resetFilters = () => {
    if (onSearchChange) {
      onSearchChange('');
    } else {
      setInternalSearchQuery('');
    }
    setActiveTierFilter('all');
    setPage(1, true);
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

    // Tier filter: filter by card's highest tier (T1 / T2 / T3)
    if (activeTierFilter !== 'all') {
      const targetTier =
        activeTierFilter === 'T1'
          ? SourceTier.T1_AUTHORITY
          : activeTierFilter === 'T2'
            ? SourceTier.T2_DEPTH
            : activeTierFilter === 'T3'
              ? SourceTier.T3_REFERENCE
              : null;

      if (targetTier) {
        result = result.filter((c) => getHighestTierBadge(c.sources).tier === targetTier);
      }
    }

    return result;
  }, [cards, searchQuery, activeTierFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));

  useEffect(() => {
    if (!isLoading && currentPage > totalPages && filteredCards.length > 0) {
      setPage(totalPages, true);
    }
  }, [currentPage, totalPages, filteredCards.length, isLoading, setPage]);

  const paginatedCards = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    return filteredCards.slice(startIndex, startIndex + pageSize);
  }, [filteredCards, currentPage, totalPages, pageSize]);

  return {
    searchQuery,
    setSearchQuery: handleSearchChange,
    activeTierFilter,
    setActiveTierFilter: handleTierFilterChange,
    currentPage,
    setCurrentPage: setPage,
    pageSize,
    setPageSize,
    resetFilters,
    filteredCards,
    paginatedCards,
    totalPages,
  };
}
