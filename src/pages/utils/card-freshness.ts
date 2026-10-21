import { formatDateTime, formatRelativeTime } from './date-format';

export interface CardFreshnessSource {
  published_at?: number | null;
}

export interface CardFreshnessTarget {
  created_at?: number | null;
  sources?: CardFreshnessSource[];
  freshness?: CardFreshnessInfo;
}

export interface CardFreshnessInfo {
  latestPublishedAt: number;
  cardAgeHours: number;
  isNewlyEmerged: boolean;
  hasFreshSourceUpdate: boolean;
  badge: 'NEW' | null;
  relativeTimeText: string;
  tooltipText: string;
  updateTooltipText?: string | null;
}

/**
 * Retrieves temporal freshness metadata for an intelligence card.
 * Prioritizes backend precomputed freshness, with fallback for backward compatibility.
 */
export function getCardFreshnessInfo(
  card: CardFreshnessTarget,
  nowSec: number = Math.floor(Date.now() / 1000)
): CardFreshnessInfo {
  if (card.freshness) {
    return card.freshness;
  }

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
