import React from 'react';
import { ScoredIntelligenceCard } from '../../lib/db/types';
import { CloseIcon } from './Icons';

interface DetailDrawerHeaderProps {
  card: ScoredIntelligenceCard;
  isAdmin: boolean;
  isTranslating: boolean;
  currentLang: 'en' | 'vi';
  onToggleLanguage: (card: ScoredIntelligenceCard) => void;
  onClose: () => void;
}

export const DetailDrawerHeader: React.FC<DetailDrawerHeaderProps> = ({
  card,
  isAdmin,
  isTranslating,
  currentLang,
  onToggleLanguage,
  onClose,
}) => {
  return (
    <div className="drawer-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span className="terminal-prompt" style={{ fontSize: '1.05rem' }}>
          &gt; intelligence_detail
        </span>
        <span className={`badge badge-${card.status.toLowerCase()}`}>{card.status}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {isAdmin && (
          <button
            id="btn-drawer-lang-toggle"
            data-testid="btn-drawer-lang-toggle"
            onClick={() => onToggleLanguage(card)}
            disabled={isTranslating}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--accent-coral)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.15rem 0.45rem',
              cursor: isTranslating ? 'wait' : 'pointer',
              fontSize: '0.95rem',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
            title={currentLang === 'vi' ? 'Switch to English' : 'Dịch sang Tiếng Việt'}
            aria-label={currentLang === 'vi' ? 'Switch to English' : 'Dịch sang Tiếng Việt'}
          >
            <span>{currentLang === 'vi' ? '🇺🇸' : '🇻🇳'}</span>
            {isTranslating && (
              <span className="font-mono text-coral" style={{ fontSize: '0.68rem' }}>
                ...
              </span>
            )}
          </button>
        )}
        <button
          data-testid="btn-close-drawer"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
          }}
          aria-label="Close"
          title="Close"
        >
          <CloseIcon size={18} />
        </button>
      </div>
    </div>
  );
};
