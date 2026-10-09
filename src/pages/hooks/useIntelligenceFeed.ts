import { useCallback, useEffect, useRef, useState } from 'react';
import { CardStatus, ScoredIntelligenceCard } from '../../lib/db/types';
import {
  DashboardStats,
  fetchCards,
  fetchStats,
  triggerCrawl,
  updateCardAction,
} from '../services/client';

export interface UseIntelligenceFeedParams {
  topic: string;
  status: string;
  sort: string;
  isAdmin?: boolean;
}

export function useIntelligenceFeed({ topic, status, sort, isAdmin }: UseIntelligenceFeedParams) {
  const [stats, setStats] = useState<DashboardStats>({
    totalArticles: 0,
    totalClusters: 0,
    readyCount: 0,
    writtenCount: 0,
  });

  const [cards, setCards] = useState<ScoredIntelligenceCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const paramsRef = useRef({ topic, status, sort });
  useEffect(() => {
    paramsRef.current = { topic, status, sort };
  }, [topic, status, sort]);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedStats, fetchedCards] = await Promise.all([
        fetchStats(),
        fetchCards({ topic, status, sort }),
      ]);
      setStats(fetchedStats);
      setCards(fetchedCards);
    } finally {
      setIsLoading(false);
    }
  }, [topic, status, sort, isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAction = async (id: string, action: CardStatus) => {
    const allowedStatuses = status.split(',');
    setCards((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, status: action } : c))
        .filter((c) => allowedStatuses.includes(c.status))
    );

    await updateCardAction(id, action);
    const refreshedStats = await fetchStats();
    setStats(refreshedStats);
  };

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const baselineCardCount = cards.length;
    const baselineClusterCount = stats.totalClusters;

    try {
      await triggerCrawl();

      // Immediate refresh right after crawl returns
      const [postCrawlStats, postCrawlCards] = await Promise.all([
        fetchStats(),
        fetchCards(paramsRef.current),
      ]);
      if (!isMountedRef.current) return;
      setStats(postCrawlStats);
      setCards(postCrawlCards);

      // If new cards or clusters arrived immediately, finish early
      if (postCrawlCards.length > baselineCardCount || postCrawlStats.totalClusters > baselineClusterCount) {
        return;
      }

      // Smart polling: check every 10s up to 6 times (~60s max) for background LLM processing
      const maxAttempts = 6;
      const pollIntervalMs = 10000;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        if (!isMountedRef.current) return;

        const [latestStats, latestCards] = await Promise.all([
          fetchStats(),
          fetchCards(paramsRef.current),
        ]);

        if (!isMountedRef.current) return;
        setStats(latestStats);
        setCards(latestCards);

        if (latestCards.length > baselineCardCount || latestStats.totalClusters > baselineClusterCount) {
          break;
        }
      }
    } catch (err) {
      console.error('[Sync] Error during sync or background polling:', err);
    } finally {
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    }
  };

  return {
    stats,
    cards,
    isLoading,
    isSyncing,
    handleAction,
    handleSync,
    loadData,
  };
}

