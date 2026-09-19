/**
 * Source Tier Configuration — Identity-Based Authority Weighting
 *
 * Phân tầng nguồn tin 3 cấp (T1/T2/T3) dựa trên uy tín người viết
 * thay vì engagement đám đông. Dùng static config, zero D1 migration.
 */

import { SourceType } from '../db/types';
import { ELEVATED_DOMAINS, HIGH_AUTHORITY_DOMAINS } from '../sources/curated-sources';

export { ELEVATED_DOMAINS, HIGH_AUTHORITY_DOMAINS };

export enum SourceTier {
  T1_AUTHORITY = 'T1',
  T2_DEPTH = 'T2',
  T3_REFERENCE = 'T3',
}

export interface SourceTierConfig {
  tier: SourceTier;
  weight: number; // 0.0 – 1.0
  label: string;
}

const TIER_CONFIGS: Record<SourceTier, SourceTierConfig> = {
  [SourceTier.T1_AUTHORITY]: { tier: SourceTier.T1_AUTHORITY, weight: 1.0, label: 'Authority' },
  [SourceTier.T2_DEPTH]: { tier: SourceTier.T2_DEPTH, weight: 0.75, label: 'Depth' },
  [SourceTier.T3_REFERENCE]: { tier: SourceTier.T3_REFERENCE, weight: 0.4, label: 'Reference' },
};

/** Default tier per SourceType (X threads = T1, HN/Lobsters = T2, Reddit = T3) */
const SOURCE_TYPE_TIER: Record<SourceType, SourceTier> = {
  x: SourceTier.T1_AUTHORITY,
  hn: SourceTier.T2_DEPTH,
  lobsters: SourceTier.T2_DEPTH,
  rss: SourceTier.T3_REFERENCE, // overridden per-feed by domain check
  reddit: SourceTier.T3_REFERENCE,
};

/** Extract hostname from URL for domain matching */
function extractDomain(url: string): string {
  if (!url) return '';
  try {
    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(normalizedUrl).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/** Safely match a hostname against target domain (exact match or subdomain) */
export function matchDomain(hostname: string, targetDomain: string): boolean {
  return hostname === targetDomain || hostname.endsWith(`.${targetDomain}`);
}

/** Resolve tier for an RSS feed URL by checking domain authority */
function resolveRssTier(feedUrl?: string): SourceTier {
  if (!feedUrl) return SourceTier.T3_REFERENCE;
  const domain = extractDomain(feedUrl);
  if (!domain) return SourceTier.T3_REFERENCE;

  if (HIGH_AUTHORITY_DOMAINS.some((d) => matchDomain(domain, d))) {
    return SourceTier.T1_AUTHORITY;
  }
  if (ELEVATED_DOMAINS.some((d) => matchDomain(domain, d))) {
    return SourceTier.T2_DEPTH;
  }
  return SourceTier.T3_REFERENCE;
}

/** Get the tier config for a source, optionally refined by feed URL */
export function getSourceTier(source: SourceType, feedUrl?: string): SourceTierConfig {
  const baseTier = SOURCE_TYPE_TIER[source] ?? SourceTier.T3_REFERENCE;
  const tier = source === 'rss' ? resolveRssTier(feedUrl) : baseTier;
  return TIER_CONFIGS[tier];
}

/** Get the authority weight (0–1) for a source */
export function getAuthorityWeight(source: SourceType, feedUrl?: string): number {
  return getSourceTier(source, feedUrl).weight;
}

/** Structural depth keywords signaling technical substance */
const DEPTH_KEYWORDS = /\b(benchmark|architecture|latency|throughput|inference|training|fine-tun|quantiz|CUDA|kernel|distributed|replication|consensus|sharding|cache|index|migration|schema|API|SDK|runtime|compiler|parser|AST|WebAssembly|WASM|V8|isolate|edge)\b/i;
const HARD_LINK_PATTERN = /https?:\/\/(arxiv\.org|github\.com|docs\.|spec\.|rfc-editor\.org)/i;

/**
 * Detect if text has structural depth signals (technical substance).
 * Requires ≥ 2 independent signals to avoid false positives.
 * Zero LLM cost — pure regex/string analysis.
 *
 * @todo(plan-15): Scheduled for activation in Plan 15 Worker-side crawler pre-filtering pipeline.
 */
export function isStructurallyDeep(text: string): boolean {
  if (!text || text.length < 50) return false;
  let signals = 0;
  if (DEPTH_KEYWORDS.test(text)) signals++;
  if (HARD_LINK_PATTERN.test(text)) signals++;
  if (text.length > 800) signals++; // Long-form content
  return signals >= 2;
}
