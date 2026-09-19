import { describe, expect, it } from 'vitest';
import { formatDateTime, formatRelativeTime } from '../src/pages/utils/date-format';

describe('Date Formatting Utilities (formatRelativeTime & formatDateTime)', () => {
  const fixedNow = 1710000000 * 1000; // ms

  it('formatRelativeTime returns "Just now" for timestamps less than 1 minute ago', () => {
    const tsSec = 1710000000 - 30; // 30s ago
    expect(formatRelativeTime(tsSec, fixedNow)).toBe('Just now');
  });

  it('formatRelativeTime returns minutes ago correctly', () => {
    const tsSec = 1710000000 - 15 * 60; // 15 mins ago
    expect(formatRelativeTime(tsSec, fixedNow)).toBe('15m ago');
  });

  it('formatRelativeTime returns hours ago correctly', () => {
    const tsSec = 1710000000 - 3 * 3600; // 3 hours ago
    expect(formatRelativeTime(tsSec, fixedNow)).toBe('3h ago');
  });

  it('formatRelativeTime returns "Yesterday" for 1 day ago', () => {
    const tsSec = 1710000000 - 25 * 3600; // 25 hours ago
    expect(formatRelativeTime(tsSec, fixedNow)).toBe('Yesterday');
  });

  it('formatRelativeTime returns days ago correctly', () => {
    const tsSec = 1710000000 - 4 * 86400; // 4 days ago
    expect(formatRelativeTime(tsSec, fixedNow)).toBe('4d ago');
  });

  it('formatRelativeTime handles null or 0 gracefully', () => {
    expect(formatRelativeTime(null, fixedNow)).toBe('Unknown');
    expect(formatRelativeTime(0, fixedNow)).toBe('Unknown');
  });

  it('formatDateTime formats date and time with English format and timezone', () => {
    const tsSec = 1710000000;
    const formatted = formatDateTime(tsSec, 'UTC');
    expect(formatted).toContain('16:00');
    expect(formatted).toContain('09/03/2024');
  });

  it('formatDateTime handles null or 0 gracefully', () => {
    expect(formatDateTime(null)).toBe('Unknown time');
    expect(formatDateTime(0)).toBe('Unknown time');
  });
});
