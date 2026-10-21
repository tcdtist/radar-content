/**
 * Helper utilities for cluster label derivation, tags, and stable ID hashing.
 */

export function deriveStableClusterId(entityIds: string[], suffix?: string): string {
  const sorted = [...entityIds].sort();
  const key = sorted.join('|');
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const ch = key.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  const base = `cluster_${Math.abs(hash).toString(36)}`;
  return suffix ? `${base}_${suffix}` : base;
}

export function deriveClusterLabel(topEntities: string[]): string {
  const formatTitle = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  if (topEntities.length === 0) return 'Topic Group';
  if (topEntities.length === 1) return formatTitle(topEntities[0]);
  return `${formatTitle(topEntities[0])} · ${topEntities.slice(1, 3).join(', ')}`;
}

export function determineClusterTags(label: string, topEntities: string[]): string[] {
  const text = `${label} ${topEntities.join(' ')}`.toLowerCase();
  const tags: string[] = ['AI'];
  if (text.includes('system') || text.includes('model') || text.includes('route') || text.includes('bench')) {
    tags.push('System Design');
  }
  if (text.includes('api') || text.includes('backend') || text.includes('database') || text.includes('provider')) {
    tags.push('Backend');
  }
  if (text.includes('frontend') || text.includes('ui') || text.includes('css') || text.includes('react')) {
    tags.push('Frontend');
  }
  if (text.includes('security') || text.includes('cve') || text.includes('auth') || text.includes('token')) {
    tags.push('Security');
  }
  return Array.from(new Set(tags));
}
