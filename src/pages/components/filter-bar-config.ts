/** Shared configuration constants for the FilterBar component */

export const TOPICS = ['all', 'AI', 'System Design', 'Backend', 'Frontend', 'Cloud/DevOps', 'Database', 'Security'];

export const STATUS_OPTIONS = [
  { label: 'Active Signals', value: 'READY,LEAD' },
  { label: 'Ready for Draft', value: 'READY' },
  { label: 'Saved', value: 'SAVED' },
  { label: 'Written', value: 'WRITTEN' },
  { label: 'Dismissed', value: 'DISMISSED' },
];

export const TIER_FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: '🔥 T1', value: 'T1' },
  { label: 'T1+T2', value: 'T1+T2' },
];
