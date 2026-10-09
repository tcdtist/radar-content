import { formatDateTime, formatRelativeTime } from './date-format';

export interface CardFreshnessSource {
  published_at?: number | null;
}

export interface CardFreshnessTarget {
  created_at?: number | null;
  sources?: CardFreshnessSource[];
}

export interface CardFreshnessInfo {
  latestPublishedAt: number;
  cardAgeHours: number;
  isNewlyEmerged: boolean;
  hasFreshSourceUpdate: boolean;
  badge: 'NEW' | 'UPDATED' | null;
  relativeTimeText: string;
  tooltipText: string;
}

/**
 * Computes temporal freshness metadata, badges, and dual relative timestamp for an intelligence card.
 * - NEW badge: Cluster created within the last 48 hours.
 * - UPDATED badge: Older cluster (>48h) that received fresh sources within the last 72 hours.
 */
export function getCardFreshnessInfo(
  card: CardFreshnessTarget,
  nowSec: number = Math.floor(Date.now() / 1000)
): CardFreshnessInfo {
  const sources = card.sources ?? [];
  const createdAt = card.created_at ?? 0;

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

  let badge: 'NEW' | 'UPDATED' | null = null;
  if (isNewlyEmerged) {
    badge = 'NEW';
  } else if (hasFreshSourceUpdate) {
    badge = 'UPDATED';
  }

  const nowMs = nowSec * 1000;
  const relativeTimeText = hasFreshSourceUpdate
    ? `${formatRelativeTime(createdAt, nowMs)} (upd ${formatRelativeTime(latestPublishedAt, nowMs)})`
    : formatRelativeTime(createdAt || latestPublishedAt, nowMs);

  const tooltipText = hasFreshSourceUpdate
    ? `First emerged: ${formatDateTime(createdAt)} | Latest source: ${formatDateTime(latestPublishedAt)}`
    : `Emerged: ${formatDateTime(createdAt || latestPublishedAt)}`;

  return {
    latestPublishedAt,
    cardAgeHours,
    isNewlyEmerged,
    hasFreshSourceUpdate,
    badge,
    relativeTimeText,
    tooltipText,
  };
}
