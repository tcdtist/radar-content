import React from 'react';
import { ScoredIntelligenceCard } from '../../lib/db/types';
import { formatDateTime, formatRelativeTime } from '../utils/date-format';

interface DetailCardHeaderProps {
  card: ScoredIntelligenceCard;
}

export const DetailCardHeader: React.FC<DetailCardHeaderProps> = ({ card }) => {
  const publishedDate =
    card.sources.find((s) => s.published_at)?.published_at || card.created_at;
  const crawledDate =
    card.sources.find((s) => s.crawled_at)?.crawled_at || card.created_at;

  const sourcesLabel =
    card.sources
      .map((s) => (s.author ? `${s.source.toUpperCase()}: ${s.author}` : s.source.toUpperCase()))
      .slice(0, 3)
      .join(' • ') || 'Multiple sources';

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          marginBottom: '0.5rem',
        }}
      >
        <h2
          className="font-mono"
          style={{
            fontSize: '1.15rem',
            color: 'var(--text-primary)',
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          {card.label}
        </h2>
        <div
          className="badge"
          style={{
            backgroundColor: 'rgba(217, 119, 87, 0.15)',
            borderColor: 'var(--accent-coral)',
            color: 'var(--accent-coral)',
            fontSize: '0.85rem',
          }}
        >
          SCORE {card.score}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {card.topic_tags.map((t) => (
          <span
            key={t}
            className="badge"
            style={{
              backgroundColor: 'transparent',
              borderColor: 'var(--bg-tertiary)',
              color: 'var(--accent-bronze)',
            }}
          >
            #{t}
          </span>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.85rem',
          marginTop: '0.65rem',
          padding: '0.45rem 0.75rem',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--bg-tertiary)',
          fontSize: '0.74rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Sources:</span>
          <span className="font-mono text-coral">{sourcesLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Published:</span>
          <span className="font-mono">{formatRelativeTime(publishedDate)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Crawled:</span>
          <span className="font-mono">{formatDateTime(crawledDate)}</span>
        </div>
      </div>
    </div>
  );
};
