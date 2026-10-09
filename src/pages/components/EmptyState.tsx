import React from 'react';
import { BaseButton } from './BaseButton';
import { RadarIcon, RefreshIcon } from './Icons';

interface EmptyStateProps {
  onSync: () => void;
  onResetFilters: () => void;
  isSyncing?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onSync,
  onResetFilters,
  isSyncing = false,
}) => {
  return (
    <div
      className="base-card"
      style={{
        padding: '3.5rem 2rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        borderStyle: 'dashed',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--accent-bronze)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent-bronze)',
        }}
      >
        <RadarIcon size={24} />
      </div>

      <div>
        <h3
          className="font-mono"
          style={{
            fontSize: '1.1rem',
            color: 'var(--text-primary)',
            fontWeight: 600,
            marginBottom: '0.35rem',
          }}
        >
          <span className="terminal-prompt">&gt;</span> no_intelligence_cards_found
        </h3>
        <p
          style={{
            maxWidth: '520px',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}
        >
          No intelligence signals match the active filter criteria. Sync to crawl fresh tech discussions and run Leiden clustering, or reset the search filters.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
        <BaseButton variant="ghost" size="sm" onClick={onResetFilters}>
          <span>Reset Filters</span>
        </BaseButton>

        <BaseButton
          variant="coral"
          size="sm"
          onClick={onSync}
          disabled={isSyncing}
          isLoading={isSyncing}
        >
          {!isSyncing && <RefreshIcon size={13} color="#ffffff" />}
          <span>Sync</span>
        </BaseButton>
      </div>
    </div>
  );
};

