import React from 'react';
import { DashboardStats } from '../services/client';
import { BrainIcon, CheckIcon, RadarIcon, StarIcon } from './Icons';

interface StatsBarProps {
  stats: DashboardStats;
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats }) => {
  const statItems = [
    {
      label: 'Crawled Discussions',
      value: stats.totalArticles,
      color: 'var(--text-primary)',
      icon: <RadarIcon size={18} color="var(--accent-bronze)" />,
    },
    {
      label: 'Active Clusters',
      value: stats.totalClusters,
      color: 'var(--accent-coral)',
      icon: <BrainIcon size={18} color="var(--accent-coral)" />,
    },
    {
      label: 'Ready for Writing',
      value: stats.readyCount,
      color: 'var(--color-success)',
      icon: <CheckIcon size={18} color="var(--color-success)" />,
    },
    {
      label: 'Written & Published',
      value: stats.writtenCount,
      color: 'var(--accent-bronze)',
      icon: <StarIcon size={18} color="var(--accent-bronze)" />,
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem',
      }}
    >
      {statItems.map((item, idx) => (
        <div
          key={idx}
          className="base-card hover-lift"
          style={{
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              className="font-mono"
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {item.label}
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: '1.65rem',
                fontWeight: 700,
                color: item.color,
                marginTop: '0.2rem',
              }}
            >
              {item.value}
            </div>
          </div>
          <div
            style={{
              padding: '0.5rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {item.icon}
          </div>
        </div>
      ))}
    </div>
  );
};
