/**
 * Curated Sources Registry — Single Source of Truth (SSOT)
 *
 * Centralizes all high-signal information sources across crawlers,
 * domain elevation whitelists, and tier-based scoring.
 */

// ── 1. Inner Circle X/Twitter Seeds ──────────────────────────────────

/** Curated seed accounts on X (AI builders, lab leads, core compiler/engine developers) */
export const INNER_CIRCLE_X_SEEDS: readonly string[] = [
  'goon_nguyen',   // AI Agents & automation
  'karpathy',      // Neural nets & LLM education
  'swyx',          // AI Engineer Foundation
  'simonw',        // Datasette & LLM tool security
  'tdinh_me',      // Indie builder & system architecture
  'altryne',       // ThursdayAI & AI ecosystem
  '_can1357',      // Reverse engineering & compilers
  '_mohansolo',    // Codeium / AI tooling
  'alexalbert__',  // Anthropic DevRel & Claude prompting
  'jarredsumner',  // Bun creator & JS runtimes
  'rauchg',        // Vercel CEO & Next.js
];

// ── 2. High-Authority & Elevated Domains (T1 / T2) ───────────────────

/** Official AI research labs & core infrastructure blogs elevated to T1 (weight: 1.0) */
export const HIGH_AUTHORITY_DOMAINS: readonly string[] = [
  'anthropic.com',
  'openai.com',
  'simonwillison.net',
  'blog.cloudflare.com',
  'deepseek.com',
  'research.google',
  'ai.meta.com',
  'github.blog',
  'deepmind.google',
  'latent.space',
];

/** Ecosystem developer platforms and release feeds elevated to T2 (weight: 0.75) */
export const ELEVATED_DOMAINS: readonly string[] = [
  'vercel.com',
  'supabase.com',
  'huggingface.co',
  'github.com', // GitHub Releases Atom feeds
  'pytorch.org',
  'fly.io',
  'astral.sh',
  'mitchellh.com',
];

// ── 3. Curated RSS/Atom Feeds ────────────────────────────────────────

export type SourceTierCode = 'T1' | 'T2' | 'T3';

export interface RssFeedConfig {
  readonly name: string;
  readonly url: string;
  readonly defaultTopic?: string;
  readonly tier?: SourceTierCode;
  /** Fallback URLs tried when primary fails (e.g. alternative RSSHub instances) */
  readonly fallbackUrls?: readonly string[];
}

const T1_AUTHORITY_FEEDS: RssFeedConfig[] = [
  {
    name: 'GitHub Blog',
    url: 'https://github.blog/feed/',
    defaultTopic: 'Engineering',
    tier: 'T1',
  },
  {
    name: 'OpenAI Blog',
    url: 'https://openai.com/news/rss.xml',
    defaultTopic: 'AI',
    tier: 'T1',
  },
  {
    name: 'Cloudflare Blog',
    url: 'https://blog.cloudflare.com/rss/',
    defaultTopic: 'Cloud/DevOps',
    tier: 'T1',
  },
  {
    name: 'Simon Willison AI Weblog',
    url: 'https://simonwillison.net/atom/everything/',
    defaultTopic: 'AI',
    tier: 'T1',
  },
  {
    name: 'Latent Space',
    url: 'https://latent.space/feed',
    defaultTopic: 'AI',
    tier: 'T1',
  },
  {
    name: 'Google DeepMind Blog',
    url: 'https://deepmind.google/blog/rss.xml',
    defaultTopic: 'AI',
    tier: 'T1',
  },
];

// ── 3b. X/Twitter Inner Circle Reference ─────────────────────────────
// Note: RSSHub public instances are frequently rate-limited/blocked.
// Kept as reference; omitted from default active crawl to conserve subrequests.

export const RSSHUB_INSTANCES = [
  'https://rsshub.app',
  'https://rsshub.rssforever.com',
  'https://rss.fatpandac.com',
] as const;

export function buildXInnerCircleFeeds(): RssFeedConfig[] {
  return INNER_CIRCLE_X_SEEDS.map((handle) => ({
    name: `X: @${handle}`,
    url: `${RSSHUB_INSTANCES[0]}/twitter/user/${handle}`,
    defaultTopic: 'AI',
    tier: 'T1' as SourceTierCode,
    fallbackUrls: RSSHUB_INSTANCES.slice(1).map(
      (instance) => `${instance}/twitter/user/${handle}`
    ),
  }));
}

const T2_DEPTH_FEEDS: RssFeedConfig[] = [
  {
    name: 'Hugging Face Blog',
    url: 'https://huggingface.co/blog/feed.xml',
    defaultTopic: 'AI',
    tier: 'T2',
  },
  {
    name: 'Vercel Blog',
    url: 'https://vercel.com/atom',
    defaultTopic: 'Frontend',
    tier: 'T2',
  },
  {
    name: 'Supabase Blog',
    url: 'https://supabase.com/rss.xml',
    defaultTopic: 'Backend',
    tier: 'T2',
  },
  {
    name: 'Fly.io Blog',
    url: 'https://fly.io/blog/feed.xml',
    defaultTopic: 'Cloud/DevOps',
    tier: 'T2',
  },
  {
    name: 'Astral Blog',
    url: 'https://astral.sh/blog/rss.xml',
    defaultTopic: 'Engineering',
    tier: 'T2',
  },
  {
    name: 'Mitchell Hashimoto',
    url: 'https://mitchellh.com/feed.xml',
    defaultTopic: 'System Design',
    tier: 'T2',
  },
  {
    name: 'Bun Releases',
    url: 'https://github.com/oven-sh/bun/releases.atom',
    defaultTopic: 'Backend',
    tier: 'T2',
  },
  {
    name: 'Vercel AI SDK Releases',
    url: 'https://github.com/vercel/ai/releases.atom',
    defaultTopic: 'AI',
    tier: 'T2',
  },
];

const T3_REFERENCE_FEEDS: RssFeedConfig[] = [
  {
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    defaultTopic: 'AI',
    tier: 'T3',
  },
];

export const CURATED_TECH_FEEDS: readonly RssFeedConfig[] = [
  ...T1_AUTHORITY_FEEDS,
  ...T2_DEPTH_FEEDS,
  ...T3_REFERENCE_FEEDS,
];

