import React, { useEffect, useState } from 'react';
import { CardStatus, ScoredIntelligenceCard } from '../lib/db/types';
import { CardGrid } from './components/CardGrid';
import { DetailPanel } from './components/DetailPanel';
import { FilterBar } from './components/FilterBar';
import { Header } from './components/Header';
import { Pagination } from './components/Pagination';
import { StatsBar } from './components/StatsBar';
import { useAuth } from './hooks/useAuth';
import { useFilteredCards } from './hooks/useFilteredCards';
import { useIntelligenceFeed } from './hooks/useIntelligenceFeed';

export const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved === 'light' ? 'light' : 'dark';
    }
    return 'dark';
  });

  const [selectedCard, setSelectedCard] = useState<ScoredIntelligenceCard | null>(null);

  const { isAdmin, loginWithGoogle, logout } = useAuth();

  const [activeTopic, setActiveTopic] = useState('all');
  const [activeStatus, setActiveStatus] = useState('READY,LEAD');
  const [activeSort, setActiveSort] = useState('score');

  const {
    stats,
    cards,
    isLoading,
    isCrawling,
    isProcessing,
    isSyncing,
    handleAction: baseHandleAction,
    handleSyncCrawl,
    handleSyncProcess,
  } = useIntelligenceFeed({
    topic: activeTopic,
    status: activeStatus,
    sort: activeSort,
    isAdmin,
  });

  const {
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
  } = useFilteredCards({ cards });

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleProtectedSyncCrawl = () => {
    if (!isAdmin) {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.prompt();
      }
      return;
    }
    handleSyncCrawl();
  };

  const handleProtectedSyncProcess = () => {
    if (!isAdmin) {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.prompt();
      }
      return;
    }
    handleSyncProcess();
  };

  const handleAction = async (id: string, action: CardStatus) => {
    if (!isAdmin) {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.prompt();
      }
      return;
    }
    if (selectedCard && selectedCard.id === id) {
      setSelectedCard((prev) => (prev ? { ...prev, status: action } : null));
    }
    await baseHandleAction(id, action);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 180, behavior: 'smooth' });
  };

  return (
    <div className="container">
      <Header
        onSyncCrawl={handleProtectedSyncCrawl}
        onSyncProcess={handleProtectedSyncProcess}
        isCrawling={isCrawling}
        isProcessing={isProcessing}
        isSyncing={isSyncing}
        theme={theme}
        onToggleTheme={toggleTheme}
        isAdmin={isAdmin}
        onLogout={logout}
        onLoginGoogle={loginWithGoogle}
      />

      {isAdmin && <StatsBar stats={stats} />}

      <FilterBar
        activeTopic={activeTopic}
        onSelectTopic={setActiveTopic}
        activeStatus={activeStatus}
        onSelectStatus={setActiveStatus}
        activeSort={activeSort}
        onSelectSort={setActiveSort}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main>
        <CardGrid
          cards={paginatedCards}
          isLoading={isLoading}
          onSelect={setSelectedCard}
          onAction={handleAction}
          onResetFilters={resetFilters}
          onSyncCrawl={handleProtectedSyncCrawl}
          onSyncProcess={handleProtectedSyncProcess}
          isCrawling={isCrawling}
          isProcessing={isProcessing}
          isSyncing={isSyncing}
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredCards.length}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={setPageSize}
        />
      </main>

      <DetailPanel
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
        onAction={handleAction}
      />
    </div>
  );
};
