import React from 'react';
import { BaseButton } from './BaseButton';
import { GoogleAuthButton } from './GoogleAuthButton';
import { BrainIcon, LockIcon, MoonIcon, RadarIcon, RefreshIcon, SunIcon } from './Icons';

interface HeaderProps {
  onSyncCrawl: () => void;
  onSyncProcess: () => void;
  isCrawling?: boolean;
  isProcessing?: boolean;
  isSyncing?: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isAdmin: boolean;
  onLogout: () => void;
  onLoginGoogle: (token: string) => Promise<{ success: boolean; error?: string }>;
}

export const Header: React.FC<HeaderProps> = ({
  onSyncCrawl,
  onSyncProcess,
  isCrawling = false,
  isProcessing = false,
  isSyncing = false,
  theme,
  onToggleTheme,
  isAdmin,
  onLogout,
  onLoginGoogle,
}) => {
  const handleCrawlClick = () => {
    if (!isAdmin) {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.prompt();
      }
      return;
    }
    onSyncCrawl();
  };

  const handleProcessClick = () => {
    if (!isAdmin) {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.prompt();
      }
      return;
    }
    onSyncProcess();
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem 0',
        borderBottom: '1px solid var(--bg-tertiary)',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-surface-hover)',
            border: '1px solid var(--accent-coral)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-coral)',
          }}
        >
          <RadarIcon size={22} color="var(--accent-coral)" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1
              className="font-mono"
              style={{
                fontSize: '1.35rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
              }}
            >
              <span className="terminal-prompt">&gt;</span> radar_content
            </h1>
            <span className="badge badge-ready" style={{ fontSize: '0.65rem' }}>
              D1 LIVE
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            AI Content Intelligence • Graph Community Detection • Cloudflare Serverless
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <BaseButton
          id="btn-theme-toggle"
          variant="ghost"
          size="md"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <SunIcon size={14} /> : <MoonIcon size={14} />}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </BaseButton>

        {isAdmin ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              className="font-mono badge"
              style={{
                backgroundColor: 'rgba(52, 211, 153, 0.1)',
                borderColor: 'var(--color-success)',
                color: 'var(--color-success)',
                fontSize: '0.72rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              title="Administrator mode active"
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
              ADMIN
            </span>
            <BaseButton
              id="btn-auth-logout"
              variant="ghost"
              size="md"
              onClick={onLogout}
              title="Logout"
            >
              <span>Logout</span>
            </BaseButton>
          </div>
        ) : (
          <GoogleAuthButton onLogin={onLoginGoogle} />
        )}

        <BaseButton
          id="btn-trigger-crawl"
          variant="ghost"
          size="md"
          onClick={handleCrawlClick}
          disabled={isCrawling || isProcessing || isSyncing}
          isLoading={isCrawling}
          title={isAdmin ? 'Crawl sources' : 'Chỉ admin mới có quyền Ingest'}
        >
          {!isAdmin ? <LockIcon size={13} color="var(--text-muted)" /> : <RefreshIcon size={14} />}
          <span>Ingest</span>
        </BaseButton>

        <BaseButton
          id="btn-trigger-process"
          variant="coral"
          size="md"
          onClick={handleProcessClick}
          disabled={isCrawling || isProcessing || isSyncing}
          isLoading={isProcessing}
          title={isAdmin ? 'Run LLM extraction & clustering' : 'Chỉ admin mới có quyền Run Intelligence'}
        >
          {!isAdmin ? <LockIcon size={13} color="#ffffff" /> : <BrainIcon size={14} color="#ffffff" />}
          <span>Run Intelligence</span>
        </BaseButton>
      </div>
    </header>
  );
};
