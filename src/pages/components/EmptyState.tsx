import React from 'react';
import { BaseButton } from './BaseButton';
import { BrainIcon, RadarIcon, RefreshIcon } from './Icons';

interface EmptyStateProps {
  onSyncCrawl: () => void;
  onSyncProcess: () => void;
  onResetFilters: () => void;
  isCrawling?: boolean;
  isProcessing?: boolean;
  isSyncing?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onSyncCrawl,
  onSyncProcess,
  onResetFilters,
  isCrawling = false,
  isProcessing = false,
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
          No intelligence signals match the active filter criteria. Ingest fresh tech discussions from Hacker News and Reddit, trigger Leiden clustering, or reset the search filters.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
        <BaseButton variant="ghost" size="sm" onClick={onResetFilters}>
          <span>Reset Filters</span>
        </BaseButton>

        <BaseButton
          variant="ghost"
          size="sm"
          onClick={onSyncCrawl}
          disabled={isCrawling || isProcessing || isSyncing}
          isLoading={isCrawling}
        >
          <RefreshIcon size={13} />
          <span>Ingest Now</span>
        </BaseButton>

        <BaseButton
          variant="coral"
          size="sm"
          onClick={onSyncProcess}
          disabled={isCrawling || isProcessing || isSyncing}
          isLoading={isProcessing}
        >
          <BrainIcon size={13} color="#ffffff" />
          <span>Run Intelligence</span>
        </BaseButton>
      </div>
    </div>
  );
};
