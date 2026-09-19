import React from 'react';
import { LockIcon } from './Icons';

export const LockedTeaserCard: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.45rem',
        padding: '1.25rem 1rem 0.25rem',
        color: 'var(--text-muted)',
        fontSize: '0.82rem',
        textAlign: 'center',
        flexWrap: 'wrap',
      }}
    >
      <LockIcon size={13} color="var(--accent-coral)" />
      <span>+84 more deep intelligence cards in database</span>
    </div>
  );
};
