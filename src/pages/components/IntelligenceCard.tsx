import React from 'react';
import { CardStatus, ScoredIntelligenceCard } from '../../lib/db/types';
import { getCardFreshnessInfo } from '../utils/card-freshness';
import { getHighestTierBadge } from '../utils/tier-badge';
import { BaseButton } from './BaseButton';
import { ArrowRightIcon, CheckIcon, ClockIcon, StarIcon, TrashIcon } from './Icons';

interface IntelligenceCardProps {
  card: ScoredIntelligenceCard;
  onSelect: (card: ScoredIntelligenceCard) => void;
  onAction: (id: string, action: CardStatus) => void;
}

export const IntelligenceCard: React.FC<IntelligenceCardProps> = ({ card, onSelect, onAction }) => {
  const primaryAuthors = Array.from(
    new Set(
      card.sources
        .map((s) => (s.author ? `${s.source.toUpperCase()}: ${s.author}` : s.source.toUpperCase()))
        .filter(Boolean)
    )
  ).slice(0, 2);

  const highestTier = card.highest_tier || getHighestTierBadge(card);
  const freshness = card.freshness || getCardFreshnessInfo(card);
  const distinctSourcesCount =
    card.source_count > 0
      ? card.source_count
      : new Set(card.sources.map((s) => s.source)).size;
  const threadCount = card.article_count || card.sources.length;
  const evidenceCount = card.evidence.length;

  return (
    <div
      className="base-card hover-lift"
      data-testid="intelligence-card"
      style={{
        padding: '1.25rem',
        cursor: 'pointer',
      }}
      onClick={() => onSelect(card)}
    >
      {/* Card Content Body: Header, Provenance, Title, Summary */}
      <div className="card-body-section">
        {/* Card Header: Badges & Score */}
        <div className="card-header-bar">
          <div className="card-tags-list">
            <span className={`badge badge-${card.status.toLowerCase()}`}>{card.status}</span>
            {freshness.badge === 'NEW' && <span className="badge card-badge-new">NEW</span>}
            {card.topic_tags.slice(0, 2).map((tag) => (
              <span key={tag} className="badge card-tag-pill" title={`#${tag}`}>
                #{tag}
              </span>
            ))}
          </div>

          <div className="card-score-group">
            {card.status === 'SEALED' && <span className="card-badge-sealed">DEEP DIVE</span>}
            <span className={`badge ${highestTier.className}`} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
              {highestTier.emoji} {highestTier.label}
            </span>
            <div className="font-mono card-score-box">
              SCORE {card.score}
            </div>
          </div>
        </div>

        {/* Source Provenance & Freshness Bar */}
        <div className="card-provenance-bar">
          <div className="card-author-list">
            {primaryAuthors.map((item, idx) => (
              <span key={idx} className="font-mono card-author-pill" title={item}>
                {item}
              </span>
            ))}
          </div>
          <div className="card-freshness-group" title={freshness.tooltipText}>
            <ClockIcon size={12} color="var(--text-muted)" />
            <span className="font-mono">{freshness.relativeTimeText}</span>
            {freshness.hasFreshSourceUpdate && (
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#3b82f6',
                  display: 'inline-block',
                  cursor: 'help',
                }}
                title={freshness.updateTooltipText || undefined}
              />
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-mono card-title-line" title={card.label}>
          {card.label}
        </h3>

        {/* Summary snippet */}
        <p className="card-summary-clamped">
          {card.summary}
        </p>
      </div>

      {/* Footer: Metrics & Action Bar */}
      <div className="card-footer-section">
        <div className="font-mono card-metrics-row">
          <span title={`${evidenceCount} extracted evidence points`}>
            {evidenceCount} {evidenceCount === 1 ? 'evidence pt' : 'evidence pts'}
          </span>
          <span title={`${distinctSourcesCount} distinct platform sources (e.g. X, HN, RSS)`}>
            {distinctSourcesCount} {distinctSourcesCount === 1 ? 'source' : 'sources'}
          </span>
          <span title={`${threadCount} discussion threads / articles`}>
            {threadCount} {threadCount === 1 ? 'thread' : 'threads'}
          </span>
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
