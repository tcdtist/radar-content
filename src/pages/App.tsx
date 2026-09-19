import React, { useEffect, useState } from 'react';
import { CardStatus, ScoredIntelligenceCard } from '../lib/db/types';
import { CardGrid } from './components/CardGrid';
import { DetailPanel } from './components/DetailPanel';
import { FilterBar } from './components/FilterBar';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Pagination } from './components/Pagination';
import { PreviewBanner } from './components/PreviewBanner';
import { StatsBar } from './components/StatsBar';
import { fetchCardById } from './services/client';
import { useAuth } from './hooks/useAuth';
import { useFilteredCards } from './hooks/useFilteredCards';
import { useIntelligenceFeed } from './hooks/useIntelligenceFeed';
import { useMobileScrollPersistence } from './hooks/useMobileScrollPersistence';
import { useTheme } from './hooks/useTheme';
import { useUrlNavigation } from './hooks/useUrlNavigation';

export const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [selectedCard, setSelectedCard] = useState<ScoredIntelligenceCard | null>(null);
  const { cardId: urlCardId, activeTab: urlActiveTab, openCard, changeTab, closeCard } = useUrlNavigation();

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
  } = useFilteredCards({ cards });

  useMobileScrollPersistence(!isLoading && cards.length > 0);

  // Synchronize selectedCard with URL deep-link / reload
  useEffect(() => {
    if (!urlCardId) {
      if (selectedCard) setSelectedCard(null);
      return;
    }
    if (selectedCard && selectedCard.id === urlCardId) return;

    const found = cards.find((c) => c.id === urlCardId);
    if (found) {
      setSelectedCard(found);
    } else if (!isLoading) {
      fetchCardById(urlCardId).then((c) => {
        if (c) setSelectedCard(c);
      });
    }
  }, [urlCardId, cards, isLoading, selectedCard]);

  const triggerGoogleSignIn = () => {
    const btn = document.getElementById('btn-google-login');
    if (btn) {
      btn.click();
    } else if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  };

  const handleProtectedAction = (action: () => void) => {
    if (!isAdmin) triggerGoogleSignIn();
    else action();
  };

  const handleAction = async (id: string, action: CardStatus) => {
    if (!isAdmin) {
      triggerGoogleSignIn();
      return;
    }
    if (selectedCard && selectedCard.id === id) {
      setSelectedCard((prev) => (prev ? { ...prev, status: action } : null));
    }
    await baseHandleAction(id, action);
  };

  const handleResetFilters = () => {
    setActiveTopic('all');
    setActiveStatus('READY,LEAD');
    setActiveSort('score');
    resetFilters();
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 180, behavior: 'smooth' });
  };

  return (
    <div className="container">
      <Header
        onSyncCrawl={() => handleProtectedAction(handleSyncCrawl)}
        onSyncProcess={() => handleProtectedAction(handleSyncProcess)}
        isCrawling={isCrawling}
        isProcessing={isProcessing}
        isSyncing={isSyncing}
        theme={theme}
        onToggleTheme={toggleTheme}
        isAdmin={isAdmin}
        onLogout={logout}
        onLoginGoogle={loginWithGoogle}
      />

      {isAdmin ? <StatsBar stats={stats} /> : <PreviewBanner />}

      <FilterBar
        activeTopic={activeTopic}
        onSelectTopic={setActiveTopic}
        activeStatus={activeStatus}
        onSelectStatus={setActiveStatus}
        activeSort={activeSort}
        onSelectSort={setActiveSort}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTierFilter={activeTierFilter}
        onTierFilterChange={setActiveTierFilter}
      />

      <main>
        <CardGrid
          cards={paginatedCards}
          isLoading={isLoading}
          onSelect={(c) => {
            setSelectedCard(c);
            openCard(c.id);
          }}
          onAction={handleAction}
          onResetFilters={handleResetFilters}
          onSyncCrawl={() => handleProtectedAction(handleSyncCrawl)}
          onSyncProcess={() => handleProtectedAction(handleSyncProcess)}
          isCrawling={isCrawling}
          isProcessing={isProcessing}
          isSyncing={isSyncing}
          isAdmin={isAdmin}
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

      <Footer />

      <DetailPanel
        card={selectedCard}
        onClose={() => {
          setSelectedCard(null);
          closeCard();
        }}
        onAction={handleAction}
        isAdmin={isAdmin}
        activeTab={urlActiveTab}
        onTabChange={changeTab}
      />
    </div>
  );
};

