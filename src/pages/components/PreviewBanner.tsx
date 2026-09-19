import React from 'react';
import { RadarIcon } from './Icons';

export const PreviewBanner: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.85rem 1.25rem',
        borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(90deg, rgba(212, 162, 127, 0.08) 0%, rgba(218, 119, 86, 0.05) 100%)',
        border: '1px solid rgba(212, 162, 127, 0.25)',
        marginBottom: '1.25rem',
        gap: '1rem',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '260px' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'rgba(212, 162, 127, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-bronze)',
            flexShrink: 0,
          }}
        >
          <RadarIcon size={16} color="var(--accent-bronze)" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span
              className="font-mono"
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--accent-bronze)',
                letterSpacing: '0.02em',
              }}
            >
              PREVIEW MODE
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>•</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Top 12 Scored Intelligence Cards Snapshot
            </span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
            Sign in as administrator to unlock real-time live feeds and automatic pipeline sync.
          </p>
        </div>
      </div>
    </div>
  );
};
