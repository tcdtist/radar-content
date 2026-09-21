import { useCallback, useEffect, useState } from 'react';
import { TabKey } from '../components/DetailTabsContent';
import {
  isValidTab,
  parsePageParam,
  parsePageSizeParam,
  parseSearchParam,
  parseSortParam,
  parseStatusParam,
  parseTopicParam,
  PageSize,
  SortOption,
  updateUrl,
} from './url-params';

export * from './url-params';

const getParam = (key: string) => {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(key);
};

export function useUrlNavigation() {
  const [cardId, setCardId] = useState<string | null>(() => getParam('card'));
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const tab = getParam('tab');
    return isValidTab(tab) ? tab : 'summary';
  });
  const [currentPage, setCurrentPage] = useState<number>(() => parsePageParam(getParam('page')));
  const [pageSize, setPageSize] = useState<PageSize>(() => parsePageSizeParam(getParam('pageSize')));
  const [topic, setTopic] = useState<string>(() => parseTopicParam(getParam('topic')));
  const [status, setStatus] = useState<string>(() => parseStatusParam(getParam('status')));
  const [sort, setSort] = useState<SortOption>(() => parseSortParam(getParam('sort')));
  const [searchQuery, setSearchQuery] = useState<string>(() => parseSearchParam(getParam('q')));

  // Synchronize on browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setCardId(params.get('card'));
      setActiveTab(isValidTab(params.get('tab')) ? (params.get('tab') as TabKey) : 'summary');
      setCurrentPage(parsePageParam(params.get('page')));
      setPageSize(parsePageSizeParam(params.get('pageSize')));
      setTopic(parseTopicParam(params.get('topic')));
      setStatus(parseStatusParam(params.get('status')));
      setSort(parseSortParam(params.get('sort')));
      setSearchQuery(parseSearchParam(params.get('q')));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const changePage = useCallback((newPage: number, replace = false) => {
    const validPage = Math.max(1, newPage);
    setCurrentPage(validPage);
    updateUrl(
      (params) => {
        if (validPage === 1) params.delete('page');
        else params.set('page', String(validPage));
      },
      replace,
      { page: validPage }
    );
  }, []);

  const changePageSize = useCallback((newSize: number) => {
    const validSize = parsePageSizeParam(String(newSize));
    setPageSize(validSize);
    updateUrl(
      (params) => {
        if (validSize === 6) params.delete('pageSize');
        else params.set('pageSize', String(validSize));
      },
      false,
      { pageSize: validSize }
    );
  }, []);

  const changeTopic = useCallback((newTopic: string) => {
    const validTopic = parseTopicParam(newTopic);
    setTopic(validTopic);
    setCurrentPage(1);
    updateUrl((params) => {
      if (validTopic === 'all') params.delete('topic');
      else params.set('topic', validTopic);
      params.delete('page');
    });
  }, []);

  const changeStatus = useCallback((newStatus: string) => {
    const validStatus = parseStatusParam(newStatus);
    setStatus(validStatus);
    setCurrentPage(1);
    updateUrl((params) => {
      if (validStatus === 'READY,LEAD') params.delete('status');
      else params.set('status', validStatus);
      params.delete('page');
    });
  }, []);

  const changeSort = useCallback((newSort: string) => {
    const validSort = parseSortParam(newSort);
    setSort(validSort);
    setCurrentPage(1);
    updateUrl((params) => {
      if (validSort === 'score') params.delete('sort');
      else params.set('sort', validSort);
      params.delete('page');
    });
  }, []);

  const changeSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    const trimmed = query.trim();
    updateUrl((params) => {
      if (!trimmed) params.delete('q');
      else params.set('q', trimmed);
      params.delete('page');
    }, true);
  }, []);

  const resetUrlFilters = useCallback(() => {
    setTopic('all');
    setStatus('READY,LEAD');
    setSort('score');
    setSearchQuery('');
    setCurrentPage(1);
    updateUrl((params) => {
      params.delete('topic');
      params.delete('status');
      params.delete('sort');
      params.delete('q');
      params.delete('page');
    });
  }, []);

  const openCard = useCallback((id: string, initialTab: TabKey = 'summary') => {
    setCardId(id);
    const validTab = isValidTab(initialTab) ? initialTab : 'summary';
    setActiveTab(validTab);
    updateUrl(
      (params) => {
        params.set('card', id);
        params.set('tab', validTab);
      },
      false,
      { cardId: id, tab: validTab }
    );
  }, []);

  const changeTab = useCallback((newTab: TabKey) => {
    const validTab = isValidTab(newTab) ? newTab : 'summary';
    setActiveTab(validTab);
    updateUrl((params) => params.set('tab', validTab), true, { tab: validTab });
  }, []);

  const closeCard = useCallback(() => {
    setCardId(null);
    setActiveTab('summary');
    updateUrl((params) => {
      params.delete('card');
      params.delete('tab');
    });
  }, []);

  return {
    cardId,
    activeTab,
    currentPage,
    changePage,
    pageSize,
    changePageSize,
    topic,
    changeTopic,
    status,
    changeStatus,
    sort,
    changeSort,
    searchQuery,
    changeSearch,
    resetUrlFilters,
    openCard,
    changeTab,
    closeCard,
  };
}
