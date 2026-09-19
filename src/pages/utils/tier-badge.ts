/**
 * Tier Badge Utility — Maps SourceType to visual tier indicators
 */

import { SourceType } from '../../lib/db/types';
import { getSourceTier, SourceTier } from '../../lib/scoring/source-tiers';

export interface TierBadgeInfo {
  emoji: string;
  label: string;
  className: string;
  tier: SourceTier;
}

const TIER_BADGE_MAP: Record<SourceTier, TierBadgeInfo> = {
  [SourceTier.T1_AUTHORITY]: { emoji: '🔥', label: 'T1', className: 'badge-tier-1', tier: SourceTier.T1_AUTHORITY },
  [SourceTier.T2_DEPTH]: { emoji: '📊', label: 'T2', className: 'badge-tier-2', tier: SourceTier.T2_DEPTH },
  [SourceTier.T3_REFERENCE]: { emoji: '📰', label: 'T3', className: 'badge-tier-3', tier: SourceTier.T3_REFERENCE },
};

/** Get badge info for a specific source, optionally refined by URL for RSS feeds */
export function getTierBadge(source: SourceType, url?: string): TierBadgeInfo {
  const config = getSourceTier(source, url);
  return TIER_BADGE_MAP[config.tier];
}

/** Get the highest tier badge across all sources in a card */
export function getHighestTierBadge(sources?: Array<{ source: SourceType; url?: string }>): TierBadgeInfo {
  if (!sources || sources.length === 0) return TIER_BADGE_MAP[SourceTier.T3_REFERENCE];
  const tiers = sources.map((s) => getSourceTier(s.source, s.url).tier);
  if (tiers.includes(SourceTier.T1_AUTHORITY)) return TIER_BADGE_MAP[SourceTier.T1_AUTHORITY];
  if (tiers.includes(SourceTier.T2_DEPTH)) return TIER_BADGE_MAP[SourceTier.T2_DEPTH];
  return TIER_BADGE_MAP[SourceTier.T3_REFERENCE];
}
