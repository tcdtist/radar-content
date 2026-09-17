import React from 'react';
import { ScoredIntelligenceCard } from '../../lib/db/types';

export type TabKey = 'summary' | 'evidence' | 'counter' | 'context' | 'verify' | 'sources';

interface DetailTabsContentProps {
  card: ScoredIntelligenceCard;
  activeTab: TabKey;
}

export const DetailTabsContent: React.FC<DetailTabsContentProps> = ({ card, activeTab }) => {
  if (activeTab === 'summary') {
    return (
      <div className="card" style={{ padding: '1.15rem' }}>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {card.summary}
        </p>
      </div>
    );
  }

  if (activeTab === 'evidence') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {card.evidence.map((item, idx) => (
          <div key={idx} className="card" style={{ padding: '0.85rem', display: 'flex', gap: '0.65rem' }}>
            <span className="font-mono text-coral" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              0{idx + 1}
            </span>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {item}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (activeTab === 'counter') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {card.counter.map((item, idx) => (
          <div
            key={idx}
            className="card"
            style={{ padding: '0.85rem', display: 'flex', gap: '0.65rem', borderLeft: '3px solid var(--accent-coral)' }}
          >
            <span className="font-mono text-coral" style={{ fontSize: '0.8rem' }}>!</span>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {item}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (activeTab === 'context') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {card.context.map((item, idx) => (
          <div key={idx} className="card" style={{ padding: '0.85rem' }}>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {item}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (activeTab === 'verify') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {card.verification_questions.map((q, idx) => (
          <div key={idx} className="card" style={{ padding: '0.85rem', display: 'flex', gap: '0.65rem' }}>
            <span className="font-mono text-muted" style={{ fontSize: '0.8rem' }}>?</span>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {q}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (activeTab === 'sources') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {card.sources.map((s, idx) => (
          <div key={idx} className="card" style={{ padding: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span className="badge font-mono" style={{ fontSize: '0.7rem' }}>
                {s.source.toUpperCase()}
              </span>
              {s.published_at && (
                <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {new Date(s.published_at * 1000).toLocaleDateString()}
                </span>
              )}
            </div>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500, fontSize: '0.86rem' }}
            >
              {s.title}
            </a>
          </div>
        ))}
      </div>
    );
  }

  return null;
};
