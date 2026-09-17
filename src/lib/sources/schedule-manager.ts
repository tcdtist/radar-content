/**
 * Configurable Crawl Schedule Manager
 * Controls automated crawl frequency according to user preferences:
 * - 1x/day: 00:01 (Midnight)
 * - 2x/day: 00:01, 12:01 (Noon)
 * - 3x/day: 00:01, 12:01, 18:01 (Evening)
 * - 4x/day: 00:01, 06:01, 12:01, 18:01 (Morning)
 */

export interface ScheduleDecision {
  shouldRun: boolean;
  reason: string;
  frequency: number;
  localHour: number;
  activeSlots: number[];
  timezone: string;
}

/**
 * Returns the active hour slots (0-23) based on configured frequency (1 to 4 times per day).
 */
export function getActiveSlotsForFrequency(frequency: number): number[] {
  switch (frequency) {
    case 1:
      return [0]; // 00:01 AM
    case 2:
      return [0, 12]; // 00:01 AM, 12:01 PM
    case 3:
      return [0, 12, 18]; // 00:01 AM, 12:01 PM, 18:01 PM
    case 4:
    default:
      return [0, 6, 12, 18]; // 00:01 AM, 06:01 AM, 12:01 PM, 18:01 PM
  }
}

/**
 * Extracts the 24-hour representation in the target timezone.
 */
export function getLocalHour(
  timestampMs: number = Date.now(),
  timeZone: string = 'Asia/Ho_Chi_Minh'
): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hourCycle: 'h23',
    });
    const hourStr = formatter.format(new Date(timestampMs));
    return parseInt(hourStr, 10) % 24;
  } catch {
    // Fallback: UTC+7 offset calculation if Intl timezone fails
    const offsetMs = 7 * 60 * 60 * 1000;
    const localDate = new Date(timestampMs + offsetMs);
    return localDate.getUTCHours();
  }
}

/**
 * Evaluates whether the scheduled cron execution should proceed or skip.
 */
export function shouldExecuteCrawl(
  crawlFrequency: string | number | undefined,
  timestampMs: number = Date.now(),
  timeZone: string = 'Asia/Ho_Chi_Minh'
): ScheduleDecision {
  const rawParsed = typeof crawlFrequency === 'number' ? crawlFrequency : parseInt(crawlFrequency ?? '1', 10);
  const parsed = Number.isInteger(rawParsed) ? rawParsed : 1;
  const frequency = Math.min(4, Math.max(1, parsed));
  const localHour = getLocalHour(timestampMs, timeZone);
  const activeSlots = getActiveSlotsForFrequency(frequency);

  // Match slot allowing +/- 1 hour margin for Cloudflare edge cron scheduling jitter
  const isSlotMatch = activeSlots.some((slot) => {
    const diff = Math.abs(slot - localHour);
    return Math.min(diff, 24 - diff) <= 1;
  });

  if (!isSlotMatch) {
    return {
      shouldRun: false,
      reason: `Skipped: Local hour ${localHour}:00 is not in active slots [${activeSlots.map((s) => `${s}:01`).join(', ')}] for frequency ${frequency}x/day.`,
      frequency,
      localHour,
      activeSlots,
      timezone: timeZone,
    };
  }

  return {
    shouldRun: true,
    reason: `Approved: Local hour ${localHour}:00 matches active slots [${activeSlots.map((s) => `${s}:01`).join(', ')}] for frequency ${frequency}x/day.`,
    frequency,
    localHour,
    activeSlots,
    timezone: timeZone,
  };
}
