import React from 'react';
import { CardTranslation, ScoredIntelligenceCard } from '../../lib/db/types';
import { formatDateTime, formatRelativeTime } from '../utils/date-format';
import { getTierBadge } from '../utils/tier-badge';
import { ClockIcon, ExternalLinkIcon } from './Icons';

export type TabKey = 'summary' | 'evidence' | 'counter' | 'context' | 'verify' | 'sources';

interface DetailTabsContentProps {
  card: ScoredIntelligenceCard;
  activeTab: TabKey;
  translation?: CardTranslation | null;
}

export const DetailTabsContent: React.FC<DetailTabsContentProps> = ({ card, activeTab, translation }) => {
  const pad = (t?: string[], orig: string[] = []) =>
    t && t.length ? (t.length >= orig.length ? t : [...t, ...orig.slice(t.length)]) : orig;

  const summary = translation?.summary || card.summary;
  const evidence = pad(translation?.evidence, card.evidence);
  const counter = pad(translation?.counter, card.counter);
  const context = pad(translation?.context, card.context);
  const verificationQuestions = pad(translation?.verification_questions, card.verification_questions);

  if (activeTab === 'summary') {
    return (
      <div className="card" style={{ padding: '1.15rem' }}>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {summary}
        </p>
      </div>
    );
  }

  if (activeTab === 'evidence') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {evidence.map((item, idx) => (
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
        {counter.map((item, idx) => (
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
        {context.map((item, idx) => (
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
        {verificationQuestions.map((q, idx) => (
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {card.sources.map((s, idx) => (
          <div key={idx} className="card" style={{ padding: '0.95rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span className="badge font-mono" style={{ fontSize: '0.72rem', fontWeight: 700, backgroundColor: 'var(--bg-tertiary)' }}>
                  {s.source.toUpperCase()}
                </span>
                <span className={`badge ${getTierBadge(s.source, s.url).className}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem' }}>
                  {getTierBadge(s.source, s.url).emoji} {getTierBadge(s.source, s.url).label}
                </span>
                {s.author && (
                  <span className="font-mono text-coral" style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                    {s.author}
                  </span>
                )}
              </div>
              {s.published_at && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <ClockIcon size={12} color="var(--text-muted)" />
                  <span className="font-mono">{formatRelativeTime(s.published_at)}</span>
                </div>
              )}
            </div>

            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--text-primary)',
                textDecoration: 'none',
                fontWeight: 500,
                fontSize: '0.9rem',
                lineHeight: 1.45,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>{s.title}</span>
              <ExternalLinkIcon size={13} color="var(--text-muted)" />
            </a>

            <div
              className="font-mono"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                paddingTop: '0.4rem',
                borderTop: '1px solid var(--bg-tertiary)',
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Published: </span>
                <span>{s.published_at ? formatDateTime(s.published_at) : 'Unknown'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Crawled: </span>
                <span>{formatDateTime(s.crawled_at || card.created_at)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
};
