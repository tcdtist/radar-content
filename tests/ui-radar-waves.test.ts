import { describe, expect, it } from 'vitest';
import { STATUS_OPTIONS } from '../src/pages/components/filter-bar-config';
import { formatDateWindow } from '../src/pages/utils/date-format';

describe('UI Radar Waves & Dynamic Date Badge (Phase 03)', () => {
  it('formatDateWindow returns "Last 7 Days" when cards array is empty or undefined', () => {
    expect(formatDateWindow([])).toBe('Last 7 Days');
    expect(formatDateWindow(undefined)).toBe('Last 7 Days');
  });

  it('formatDateWindow calculates earliest date correctly and formats as DD/MM - Today', () => {
    // 14 Oct 2026 10:00:00 GMT+7 = 1791946800
    const oct14 = 1791946800;
    const oct18 = 1792292400;

    const mockCards = [
      {
        created_at: oct18,
        sources: [{ published_at: oct18 }],
      },
      {
        created_at: oct14,
        sources: [{ published_at: oct14 }],
      },
    ];

    const result = formatDateWindow(mockCards, 'Asia/Ho_Chi_Minh');
    expect(result).toBe('14/10 - Today');
  });

  it('STATUS_OPTIONS includes Deep Dives for SEALED topic archive', () => {
    const deepDivesOpt = STATUS_OPTIONS.find((opt) => opt.value === 'SEALED');
    expect(deepDivesOpt).toBeDefined();
    expect(deepDivesOpt?.label).toBe('Deep Dives');
  });
});
