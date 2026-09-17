import React from 'react';
import { CardStatus, ScoredIntelligenceCard } from '../../lib/db/types';
import { BaseButton } from './BaseButton';
import { ArrowRightIcon, CheckIcon, StarIcon, TrashIcon } from './Icons';

interface IntelligenceCardProps {
  card: ScoredIntelligenceCard;
  onSelect: (card: ScoredIntelligenceCard) => void;
  onAction: (id: string, action: CardStatus) => void;
}

export const IntelligenceCard: React.FC<IntelligenceCardProps> = ({
  card,
  onSelect,
  onAction,
}) => {
  return (
    <div
      className="base-card hover-lift"
      data-testid="intelligence-card"
      style={{
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '1rem',
        cursor: 'pointer',
      }}
      onClick={() => onSelect(card)}
    >
      {/* Card Header: Badges & Score */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.65rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={`badge badge-${card.status.toLowerCase()}`}>
              {card.status}
            </span>
            {card.topic_tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="badge"
                style={{
                  backgroundColor: 'transparent',
                  borderColor: 'var(--bg-tertiary)',
                  color: 'var(--accent-bronze)',
                }}
              >
                #{tag}
              </span>
            ))}
          </div>

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

        {/* Title */}
        <h3
          className="font-mono"
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.4,
            marginBottom: '0.5rem',
          }}
        >
          {card.label}
        </h3>

        {/* Summary snippet */}
        <p
          style={{
            fontSize: '0.84rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
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

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <BaseButton
            data-testid="btn-inspect"
            variant="ghost"
            size="sm"
            onClick={() => onSelect(card)}
            style={{ color: 'var(--accent-coral)' }}
          >
            <span>Inspect</span>
            <ArrowRightIcon size={12} />
          </BaseButton>

          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <BaseButton
              data-testid="btn-action-save"
              variant="ghost"
              size="sm"
              onClick={() => onAction(card.id, 'SAVED')}
              title="Lưu tín hiệu (Save)"
              aria-label="Lưu tín hiệu (Save)"
            >
              <StarIcon size={13} color="var(--accent-bronze)" />
            </BaseButton>

            <BaseButton
              data-testid="btn-action-written"
              variant="ghost"
              size="sm"
              onClick={() => onAction(card.id, 'WRITTEN')}
              title="Đã viết bài (Mark Written)"
              aria-label="Đã viết bài (Mark Written)"
            >
              <CheckIcon size={13} color="var(--color-success)" />
            </BaseButton>

            <BaseButton
              data-testid="btn-action-dismiss"
              variant="ghost"
              size="sm"
              onClick={() => onAction(card.id, 'DISMISSED')}
              title="Bỏ qua (Dismiss)"
              aria-label="Bỏ qua (Dismiss)"
            >
              <TrashIcon size={13} color="var(--text-muted)" />
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  );
};
