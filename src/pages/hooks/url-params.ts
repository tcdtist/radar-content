import { TabKey } from '../components/DetailTabsContent';
import { STATUS_OPTIONS, TOPICS } from '../components/filter-bar-config';

export const VALID_TABS: readonly TabKey[] = ['summary', 'evidence', 'counter', 'context', 'verify', 'sources'];
export const VALID_PAGE_SIZES = [6, 12, 24] as const;
export type PageSize = (typeof VALID_PAGE_SIZES)[number];

export const VALID_SORTS = ['score', 'newest', 'evidence'] as const;
export type SortOption = (typeof VALID_SORTS)[number];

const VALID_STATUSES = STATUS_OPTIONS.map((o) => o.value);

export function isValidTab(val: string | null): val is TabKey {
  return typeof val === 'string' && (VALID_TABS as readonly string[]).includes(val);
}

export function parsePageParam(val: string | null): number {
  if (!val) return 1;
  const num = parseInt(val, 10);
  return Number.isInteger(num) && num > 0 ? num : 1;
}

export function parsePageSizeParam(val: string | null): PageSize {
  if (!val) return 6;
  const num = parseInt(val, 10);
  return (VALID_PAGE_SIZES as readonly number[]).includes(num) ? (num as PageSize) : 6;
}

export function parseTopicParam(val: string | null): string {
  if (!val) return 'all';
  const found = TOPICS.find((t) => t.toLowerCase() === val.toLowerCase());
  return found || 'all';
}

export function parseStatusParam(val: string | null): string {
  if (!val) return 'READY,LEAD';
  return VALID_STATUSES.includes(val) ? val : 'READY,LEAD';
}

export function parseSortParam(val: string | null): SortOption {
  if (!val) return 'score';
  return (VALID_SORTS as readonly string[]).includes(val) ? (val as SortOption) : 'score';
}

export function parseSearchParam(val: string | null): string {
  return val ? val.trim() : '';
}

export function updateUrl(
  updater: (params: URLSearchParams) => void,
  replace = false,
  extraState: Record<string, unknown> = {}
) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  updater(url.searchParams);
  const search = url.searchParams.toString();
  const newUrl = url.pathname + (search ? `?${search}` : '') + url.hash;
  const state = { ...window.history.state, ...extraState };
  if (replace) {
    window.history.replaceState(state, '', newUrl);
  } else {
    window.history.pushState(state, '', newUrl);
  }
}
