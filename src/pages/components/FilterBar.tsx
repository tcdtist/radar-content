import React from 'react';
import { CalendarIcon, SearchIcon } from './Icons';
import { STATUS_OPTIONS, TIER_FILTER_OPTIONS, TOPICS } from './filter-bar-config';

export { TOPICS, STATUS_OPTIONS, TIER_FILTER_OPTIONS };

interface FilterBarProps {
  activeTopic: string;
  onSelectTopic: (topic: string) => void;
  activeStatus: string;
  onSelectStatus: (status: string) => void;
  activeSort: string;
  onSelectSort: (sort: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeTierFilter?: string;
  onTierFilterChange?: (tier: string) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  activeTopic,
  onSelectTopic,
  activeStatus,
  onSelectStatus,
  activeSort,
  onSelectSort,
  searchQuery,
  onSearchChange,
  activeTierFilter = 'all',
  onTierFilterChange,
}) => {
  return (
    <div className="base-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.75rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '0.85rem',
        }}
      >
        {/* Status Filters */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map((opt) => {
            const slug = opt.value.toLowerCase().replace(/,/g, '-');
            const isActive = activeStatus === opt.value;
            return (
              <button
                key={opt.value}
                id={`tab-status-${slug}`}
                data-testid={`tab-status-${slug}`}
                className="btn btn-sm"
                onClick={() => onSelectStatus(opt.value)}
                style={{
                  backgroundColor: isActive ? 'var(--accent-coral)' : 'transparent',
                  borderColor: isActive ? 'var(--accent-coral)' : 'var(--bg-tertiary)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Search & Sort Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.2rem 0.65rem',
              gap: '0.5rem',
            }}
          >
            <SearchIcon size={14} color="var(--text-muted)" />
            <input
              id="input-card-search"
              type="text"
              placeholder="Search intelligence..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                width: '180px',
              }}
            />
          </div>

          <select
            id="select-sort"
            className="font-mono"
            value={activeSort}
            onChange={(e) => onSelectSort(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.35rem 0.75rem',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="score">Highest Score</option>
            <option value="newest">Newest First</option>
            <option value="evidence">Most Evidence</option>
          </select>
        </div>
      </div>

      {/* Topic Filter Pills & Date Window */}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span
            className="font-mono"
            style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}
          >
            &gt; topic:
          </span>
          {TOPICS.map((topic) => {
            const isSelected = activeTopic === topic;
            return (
              <button
                key={topic}
                id={`pill-topic-${topic}`}
                className="badge"
                onClick={() => onSelectTopic(topic)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'rgba(212, 162, 127, 0.15)' : 'transparent',
                  borderColor: isSelected ? 'var(--accent-bronze)' : 'var(--bg-tertiary)',
                  color: isSelected ? 'var(--accent-bronze)' : 'var(--text-muted)',
                  padding: '0.2rem 0.55rem',
                }}
              >
                {topic === 'all' ? 'ALL' : `#${topic.toUpperCase()}`}
              </button>
            );
          })}
          {onTierFilterChange && (
            <>
              <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0.25rem' }}>|</span>
              <select
                id="select-tier-filter"
                data-testid="select-tier-filter" aria-label="Filter by source tier"
                className="font-mono"
                value={activeTierFilter} onChange={(e) => onTierFilterChange(e.target.value)}
                style={{
                  backgroundColor: activeTierFilter !== 'all' ? 'rgba(218, 119, 86, 0.12)' : 'var(--bg-primary)',
                  border: `1px solid ${activeTierFilter !== 'all' ? 'var(--accent-coral)' : 'var(--bg-tertiary)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.2rem 0.5rem',
                  color: activeTierFilter !== 'all' ? 'var(--accent-coral)' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {TIER_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span
            className="badge"
            id="badge-date-window"
            style={{
              backgroundColor: 'rgba(218, 119, 86, 0.12)',
              borderColor: 'var(--accent-coral)',
              color: 'var(--accent-coral)',
              fontSize: '0.7rem',
            }}
          >
            <CalendarIcon size={12} />
            <span>10/09 - Today</span>
          </span>
        </div>
      </div>
    </div>
  );
};
