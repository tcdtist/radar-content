/**
 * Format timestamp (in seconds or milliseconds) to relative time in English.
 * Examples: "Just now", "10m ago", "2h ago", "Yesterday", "3d ago", "2mo ago".
 */
export function formatRelativeTime(
  timestampSeconds?: number | null,
  nowMs: number = Date.now()
): string {
  if (!timestampSeconds || timestampSeconds <= 0) {
    return 'Unknown';
  }

  // Handle seconds vs milliseconds
  const timeMs = timestampSeconds > 1e11 ? timestampSeconds : timestampSeconds * 1000;
  const diffSec = Math.max(0, Math.floor((nowMs - timeMs) / 1000));

  if (diffSec < 60) {
    return 'Just now';
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return `${diffHour}h ago`;
  }

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) {
    return 'Yesterday';
  }
  if (diffDay < 30) {
    return `${diffDay}d ago`;
  }

  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) {
    return `${diffMonth}mo ago`;
  }

  return `${Math.floor(diffMonth / 12)}y ago`;
}

/**
 * Format timestamp (in seconds or milliseconds) to full formatted date and time.
 * Example: "14:30 - 18/09/2026".
 */
export function formatDateTime(
  timestampSeconds?: number | null,
  timeZone: string = 'Asia/Ho_Chi_Minh'
): string {
  if (!timestampSeconds || timestampSeconds <= 0) {
    return 'Unknown time';
  }

  const timeMs = timestampSeconds > 1e11 ? timestampSeconds : timestampSeconds * 1000;
  const date = new Date(timeMs);

  try {
    const timeStr = date.toLocaleTimeString('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const dateStr = date.toLocaleDateString('en-GB', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return `${timeStr} - ${dateStr}`;
  } catch {
    return date.toLocaleDateString('en-GB');
  }
}

/**
 * Format dynamic date window badge from a list of intelligence cards.
 * Example: "14/10 - Today" or "Last 7 Days".
 */
export function formatDateWindow(
  cards?: Array<{ created_at?: number; sources?: Array<{ published_at?: number | null }> }>,
  timeZone: string = 'Asia/Ho_Chi_Minh'
): string {
  if (!cards || cards.length === 0) {
    return 'Last 7 Days';
  }

  let earliestSec = Infinity;
  for (const c of cards) {
    if (c.created_at && c.created_at > 0) {
      earliestSec = Math.min(earliestSec, c.created_at);
    }
    if (c.sources) {
      for (const s of c.sources) {
        if (s.published_at && s.published_at > 0) {
          earliestSec = Math.min(earliestSec, s.published_at);
        }
      }
    }
  }

  if (earliestSec === Infinity) {
    return 'Last 7 Days';
  }

  const timeMs = earliestSec > 1e11 ? earliestSec : earliestSec * 1000;
  const d = new Date(timeMs);
  try {
    const day = d.toLocaleDateString('en-GB', { timeZone, day: '2-digit' });
    const month = d.toLocaleDateString('en-GB', { timeZone, month: '2-digit' });
    return `${day}/${month} - Today`;
  } catch {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month} - Today`;
  }
}

