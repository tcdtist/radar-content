import { describe, expect, it } from 'vitest';
import {
  getActiveSlotsForFrequency,
  getLocalHour,
  shouldExecuteCrawl,
} from '../src/lib/sources/schedule-manager';

describe('Schedule Manager — Crawl Frequency & Slot Decision', () => {
  it('returns appropriate active hour slots for each frequency level', () => {
    expect(getActiveSlotsForFrequency(1)).toEqual([0]);
    expect(getActiveSlotsForFrequency(2)).toEqual([0, 12]);
    expect(getActiveSlotsForFrequency(3)).toEqual([0, 12, 18]);
    expect(getActiveSlotsForFrequency(4)).toEqual([0, 6, 12, 18]);
    expect(getActiveSlotsForFrequency(99)).toEqual([0, 6, 12, 18]);
  });

  it('correctly calculates local hour in Asia/Ho_Chi_Minh (UTC+7)', () => {
    // 2026-09-16T17:01:00Z = 2026-09-17T00:01:00+07:00
    const midnightIct = new Date('2026-09-16T17:01:00Z').getTime();
    expect(getLocalHour(midnightIct, 'Asia/Ho_Chi_Minh')).toBe(0);

    // 2026-09-16T05:01:00Z = 2026-09-16T12:01:00+07:00
    const noonIct = new Date('2026-09-16T05:01:00Z').getTime();
    expect(getLocalHour(noonIct, 'Asia/Ho_Chi_Minh')).toBe(12);

    // 2026-09-16T11:01:00Z = 2026-09-16T18:01:00+07:00
    const eveningIct = new Date('2026-09-16T11:01:00Z').getTime();
    expect(getLocalHour(eveningIct, 'Asia/Ho_Chi_Minh')).toBe(18);

    // 2026-09-16T23:01:00Z = 2026-09-17T06:01:00+07:00
    const morningIct = new Date('2026-09-16T23:01:00Z').getTime();
    expect(getLocalHour(morningIct, 'Asia/Ho_Chi_Minh')).toBe(6);
  });

  describe('Frequency = 1x/day (Midnight only)', () => {
    it('executes at 00:01 AM and skips 06:01, 12:01, 18:01', () => {
      const midnight = new Date('2026-09-16T17:01:00Z').getTime();
      const morning = new Date('2026-09-16T23:01:00Z').getTime();
      const noon = new Date('2026-09-16T05:01:00Z').getTime();
      const evening = new Date('2026-09-16T11:01:00Z').getTime();

      expect(shouldExecuteCrawl('1', midnight).shouldRun).toBe(true);
      expect(shouldExecuteCrawl('1', morning).shouldRun).toBe(false);
      expect(shouldExecuteCrawl('1', noon).shouldRun).toBe(false);
      expect(shouldExecuteCrawl('1', evening).shouldRun).toBe(false);
    });
  });

  describe('Frequency = 2x/day (Midnight & Noon)', () => {
    it('executes at 00:01 and 12:01, skips 06:01 and 18:01', () => {
      const midnight = new Date('2026-09-16T17:01:00Z').getTime();
      const morning = new Date('2026-09-16T23:01:00Z').getTime();
      const noon = new Date('2026-09-16T05:01:00Z').getTime();
      const evening = new Date('2026-09-16T11:01:00Z').getTime();

      expect(shouldExecuteCrawl('2', midnight).shouldRun).toBe(true);
      expect(shouldExecuteCrawl('2', noon).shouldRun).toBe(true);
      expect(shouldExecuteCrawl('2', morning).shouldRun).toBe(false);
      expect(shouldExecuteCrawl('2', evening).shouldRun).toBe(false);
    });
  });

  describe('Frequency = 3x/day (Midnight, Noon, Evening)', () => {
    it('executes at 00:01, 12:01, 18:01 and skips 06:01', () => {
      const midnight = new Date('2026-09-16T17:01:00Z').getTime();
      const morning = new Date('2026-09-16T23:01:00Z').getTime();
      const noon = new Date('2026-09-16T05:01:00Z').getTime();
      const evening = new Date('2026-09-16T11:01:00Z').getTime();

      expect(shouldExecuteCrawl('3', midnight).shouldRun).toBe(true);
      expect(shouldExecuteCrawl('3', noon).shouldRun).toBe(true);
      expect(shouldExecuteCrawl('3', evening).shouldRun).toBe(true);
      expect(shouldExecuteCrawl('3', morning).shouldRun).toBe(false);
    });
  });

  describe('Frequency = 4x/day (All 4 slots)', () => {
    it('executes at 00:01, 06:01, 12:01, and 18:01', () => {
      const midnight = new Date('2026-09-16T17:01:00Z').getTime();
      const morning = new Date('2026-09-16T23:01:00Z').getTime();
      const noon = new Date('2026-09-16T05:01:00Z').getTime();
      const evening = new Date('2026-09-16T11:01:00Z').getTime();

      expect(shouldExecuteCrawl('4', midnight).shouldRun).toBe(true);
      expect(shouldExecuteCrawl('4', morning).shouldRun).toBe(true);
      expect(shouldExecuteCrawl('4', noon).shouldRun).toBe(true);
      expect(shouldExecuteCrawl('4', evening).shouldRun).toBe(true);
    });
  });
});
