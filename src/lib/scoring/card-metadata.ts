import { SourceType } from '../db/types';
import { getSourceTier, SourceTier } from './source-tiers';

export interface CardFreshnessMeta {
  latestPublishedAt: number;
  cardAgeHours: number;
  isNewlyEmerged: boolean;
  hasFreshSourceUpdate: boolean;
  badge: 'NEW' | null;
  relativeTimeText: string;
  tooltipText: string;
  updateTooltipText?: string | null;
}

export interface CardTierMeta {
  emoji: string;
  label: string;
  className: string;
  tier: SourceTier;
}

const TIER_META_MAP: Record<SourceTier, CardTierMeta> = {
  [SourceTier.T1_AUTHORITY]: { emoji: '🔥', label: 'T1', className: 'badge-tier-1', tier: SourceTier.T1_AUTHORITY },
  [SourceTier.T2_DEPTH]: { emoji: '📊', label: 'T2', className: 'badge-tier-2', tier: SourceTier.T2_DEPTH },
  [SourceTier.T3_REFERENCE]: { emoji: '📰', label: 'T3', className: 'badge-tier-3', tier: SourceTier.T3_REFERENCE },
};

function formatRelativeTime(timestampSec: number, nowMs: number): string {
  const timeMs = timestampSec * 1000;
  const diffSec = Math.max(0, Math.floor((nowMs - timeMs) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffMonth / 12)}y ago`;
}

function formatDateTime(timestampSec: number): string {
  if (!timestampSec) return 'Unknown';
  return new Date(timestampSec * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export function computeCardFreshness(
  createdAt: number,
  sources: Array<{ published_at?: number | null }> = [],
  nowSec = Math.floor(Date.now() / 1000)
): CardFreshnessMeta {
  const latestPublishedAt = sources.length > 0
    ? Math.max(...sources.map((s) => s.published_at || 0))
    : createdAt;

  const cardAgeHours = createdAt > 0 ? Math.max(0, (nowSec - createdAt) / 3600) : 0;
  const isNewlyEmerged = cardAgeHours <= 48;

  const hasFreshSourceUpdate =
    !isNewlyEmerged &&
    createdAt > 0 &&
    latestPublishedAt > createdAt + 3600 &&
    nowSec - latestPublishedAt < 72 * 3600;

  const badge: 'NEW' | null = isNewlyEmerged ? 'NEW' : null;
  const nowMs = nowSec * 1000;
  const relativeTimeText = formatRelativeTime(createdAt || latestPublishedAt, nowMs);

  const tooltipText = hasFreshSourceUpdate
    ? `First emerged: ${formatDateTime(createdAt)} | Updated: ${formatDateTime(latestPublishedAt)}`
    : `Emerged: ${formatDateTime(createdAt || latestPublishedAt)}`;

  const updateTooltipText = hasFreshSourceUpdate
    ? `Updated ${formatRelativeTime(latestPublishedAt, nowMs)}`
    : null;

  return {
    latestPublishedAt,
    cardAgeHours,
    isNewlyEmerged,
    hasFreshSourceUpdate,
    badge,
    relativeTimeText,
    tooltipText,
    updateTooltipText,
  };
}

export function computeCardHighestTier(
  sources: Array<{ source: SourceType; url?: string }> = []
): CardTierMeta {
  if (!sources || sources.length === 0) return TIER_META_MAP[SourceTier.T3_REFERENCE];
  const tiers = sources.map((s) => getSourceTier(s.source, s.url).tier);
  if (tiers.includes(SourceTier.T1_AUTHORITY)) return TIER_META_MAP[SourceTier.T1_AUTHORITY];
  if (tiers.includes(SourceTier.T2_DEPTH)) return TIER_META_MAP[SourceTier.T2_DEPTH];
  return TIER_META_MAP[SourceTier.T3_REFERENCE];
}
