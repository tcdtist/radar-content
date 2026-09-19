import React from 'react';
import { ExternalLinkIcon, GithubIcon } from './Icons';

export const Footer: React.FC = () => {
  return (
    <footer
      style={{
        marginTop: '3rem',
        paddingTop: '1.5rem',
        paddingBottom: '2.5rem',
        borderTop: '1px solid var(--bg-tertiary)',
        fontSize: '0.82rem',
        color: 'var(--text-muted)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.78rem',
        }}
      >
        <div>
          <span>© 2026 radar_content</span>
        </div>

        <a
          href="https://github.com/tcdtist/radar-content"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.35rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--bg-tertiary)',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            transition: 'border-color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-coral)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--bg-tertiary)')}
        >
          <GithubIcon size={14} />
          <span>Star on GitHub</span>
          <ExternalLinkIcon size={12} color="var(--text-muted)" />
        </a>
      </div>
    </footer>
  );
};
