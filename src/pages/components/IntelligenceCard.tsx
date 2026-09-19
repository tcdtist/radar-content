import React from 'react';
import { CardStatus, ScoredIntelligenceCard } from '../../lib/db/types';
import { formatDateTime, formatRelativeTime } from '../utils/date-format';
import { getHighestTierBadge } from '../utils/tier-badge';
import { BaseButton } from './BaseButton';
import { ArrowRightIcon, CheckIcon, ClockIcon, StarIcon, TrashIcon } from './Icons';

interface IntelligenceCardProps {
  card: ScoredIntelligenceCard;
  onSelect: (card: ScoredIntelligenceCard) => void;
  onAction: (id: string, action: CardStatus) => void;
}

export const IntelligenceCard: React.FC<IntelligenceCardProps> = ({ card, onSelect, onAction }) => {
  const latestPublishedAt = card.sources.length > 0
    ? Math.max(...card.sources.map((s) => s.published_at || 0))
    : card.created_at;

  const primaryAuthors = Array.from(
    new Set(
      card.sources
        .map((s) => (s.author ? `${s.source.toUpperCase()}: ${s.author}` : s.source.toUpperCase()))
        .filter(Boolean)
    )
  ).slice(0, 2);

  const highestTier = getHighestTierBadge(card.sources);

  return (
    <div
      className="base-card hover-lift"
      data-testid="intelligence-card"
      style={{
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '0.9rem',
        cursor: 'pointer',
      }}
      onClick={() => onSelect(card)}
    >
      <div>
        {/* Card Header: Badges & Score */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.55rem' }}>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={`badge badge-${card.status.toLowerCase()}`}>{card.status}</span>
            {card.topic_tags.slice(0, 2).map((tag) => (
              <span key={tag} className="badge" style={{ backgroundColor: 'transparent', borderColor: 'var(--bg-tertiary)', color: 'var(--accent-bronze)' }}>
                #{tag}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span className={`badge ${highestTier.className}`} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
              {highestTier.emoji} {highestTier.label}
            </span>
            <div
              className="font-mono"
              style={{
                padding: '0.2rem 0.55rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--accent-coral)',
                color: 'var(--accent-coral)',
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
            >
              SCORE {card.score}
            </div>
          </div>
        </div>

        {/* Source Provenance & Freshness Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {primaryAuthors.map((item, idx) => (
              <span key={idx} className="font-mono" style={{ padding: '0.12rem 0.4rem', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                {item}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }} title={`Published: ${formatDateTime(latestPublishedAt || card.created_at)}`}>
            <ClockIcon size={12} color="var(--text-muted)" />
            <span className="font-mono">{formatRelativeTime(latestPublishedAt || card.created_at)}</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-mono" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: '0.5rem' }}>
          {card.label}
        </h3>

        {/* Summary snippet */}
        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {card.summary}
        </p>
      </div>

      {/* Metrics & Action Bar */}
      <div>
        <div
          className="font-mono"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--bg-tertiary)',
            marginBottom: '0.75rem',
          }}
        >
          <span>{card.evidence.length} evidence pts</span>
          <span>{card.sources.length} sources</span>
          <span>{card.article_count} threads</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
          <BaseButton data-testid="btn-inspect" variant="ghost" size="sm" onClick={() => onSelect(card)} style={{ color: 'var(--accent-coral)' }}>
            <span>Inspect</span>
            <ArrowRightIcon size={12} />
          </BaseButton>

          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <BaseButton data-testid="btn-action-save" variant="ghost" size="sm" onClick={() => onAction(card.id, 'SAVED')} title="Save signal" aria-label="Save signal">
              <StarIcon size={13} color="var(--accent-bronze)" />
            </BaseButton>
            <BaseButton data-testid="btn-action-written" variant="ghost" size="sm" onClick={() => onAction(card.id, 'WRITTEN')} title="Mark written" aria-label="Mark written">
              <CheckIcon size={13} color="var(--color-success)" />
            </BaseButton>
            <BaseButton data-testid="btn-action-dismiss" variant="ghost" size="sm" onClick={() => onAction(card.id, 'DISMISSED')} title="Dismiss" aria-label="Dismiss">
              <TrashIcon size={13} color="var(--text-muted)" />
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  );
};
