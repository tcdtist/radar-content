import { useCallback, useEffect, useState } from 'react';
import { CardStatus, ScoredIntelligenceCard } from '../../lib/db/types';
import {
  DashboardStats,
  fetchCards,
  fetchStats,
  triggerCrawl,
  triggerProcess,
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
  const [isCrawling, setIsCrawling] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const handleSyncCrawl = async () => {
    setIsCrawling(true);
    try {
      await triggerCrawl();
      await loadData();
    } finally {
      setIsCrawling(false);
    }
  };

  const handleSyncProcess = async () => {
    setIsProcessing(true);
    try {
      await triggerProcess();
      await loadData();
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    stats,
    cards,
    isLoading,
    isCrawling,
    isProcessing,
    isSyncing: isCrawling || isProcessing,
    handleAction,
    handleSyncCrawl,
    handleSyncProcess,
    loadData,
  };
}
