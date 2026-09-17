import React from 'react';
import { CardStatus, ScoredIntelligenceCard } from '../../lib/db/types';
import { EmptyState } from './EmptyState';
import { IntelligenceCard } from './IntelligenceCard';

interface CardGridProps {
  cards: ScoredIntelligenceCard[];
  isLoading: boolean;
  onSelect: (card: ScoredIntelligenceCard) => void;
  onAction: (id: string, action: CardStatus) => void;
  onResetFilters: () => void;
  onSyncCrawl: () => void;
  onSyncProcess: () => void;
  isCrawling?: boolean;
  isProcessing?: boolean;
  isSyncing?: boolean;
}

export const CardGrid: React.FC<CardGridProps> = ({
  cards,
  isLoading,
  onSelect,
  onAction,
  onResetFilters,
  onSyncCrawl,
  onSyncProcess,
  isCrawling = false,
  isProcessing = false,
  isSyncing = false,
}) => {
  if (isLoading) {
    return (
      <div className="card-grid">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="base-card"
            style={{
              height: '240px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              opacity: 0.6,
            }}
          >
            <div
              style={{
                height: '18px',
                width: '35%',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
              }}
            />
            <div
              style={{
                height: '24px',
                width: '80%',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
              }}
            />
            <div
              style={{
                height: '60px',
                width: '100%',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius-sm)',
              }}
            />
            <div
              style={{
                height: '20px',
                width: '50%',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                marginTop: 'auto',
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <EmptyState
        onSyncCrawl={onSyncCrawl}
        onSyncProcess={onSyncProcess}
        onResetFilters={onResetFilters}
        isCrawling={isCrawling}
        isProcessing={isProcessing}
        isSyncing={isSyncing}
      />
    );
  }

  return (
    <div className="card-grid">
      {cards.map((card) => (
        <IntelligenceCard
          key={card.id}
          card={card}
          onSelect={onSelect}
          onAction={onAction}
        />
      ))}
    </div>
  );
};
