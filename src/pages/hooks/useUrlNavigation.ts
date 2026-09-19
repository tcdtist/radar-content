import { useCallback, useEffect, useState } from 'react';
import { TabKey } from '../components/DetailTabsContent';

const VALID_TABS: readonly TabKey[] = ['summary', 'evidence', 'counter', 'context', 'verify', 'sources'];

function isValidTab(val: string | null): val is TabKey {
  return typeof val === 'string' && (VALID_TABS as readonly string[]).includes(val);
}

export function useUrlNavigation() {
  const [cardId, setCardId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('card');
  });

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window === 'undefined') return 'summary';
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    return isValidTab(tabParam) ? tabParam : 'summary';
  });

  // Synchronize on browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const urlCard = params.get('card');
      const urlTab = params.get('tab');

      setCardId(urlCard);
      setActiveTab(isValidTab(urlTab) ? urlTab : 'summary');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openCard = useCallback((id: string, initialTab: TabKey = 'summary') => {
    setCardId(id);
    const validTab = isValidTab(initialTab) ? initialTab : 'summary';
    setActiveTab(validTab);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('card', id);
      url.searchParams.set('tab', validTab);
      window.history.pushState({ cardId: id, tab: validTab }, '', url.pathname + url.search + url.hash);
    }
  }, []);

  const changeTab = useCallback((newTab: TabKey) => {
    const validTab = isValidTab(newTab) ? newTab : 'summary';
    setActiveTab(validTab);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', validTab);
      window.history.replaceState({ cardId, tab: validTab }, '', url.pathname + url.search + url.hash);
    }
  }, [cardId]);

  const closeCard = useCallback(() => {
    setCardId(null);
    setActiveTab('summary');

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('card');
      url.searchParams.delete('tab');
      window.history.pushState({}, '', url.pathname + url.search + url.hash);
    }
  }, []);

  return {
    cardId,
    activeTab,
    openCard,
    changeTab,
    closeCard,
  };
}
