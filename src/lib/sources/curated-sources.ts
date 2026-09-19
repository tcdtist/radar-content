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
];

/** Ecosystem developer platforms and release feeds elevated to T2 (weight: 0.75) */
export const ELEVATED_DOMAINS: readonly string[] = [
  'vercel.com',
  'supabase.com',
  'huggingface.co',
  'github.com', // GitHub Releases Atom feeds
  'pytorch.org',
];

// ── 3. Curated RSS/Atom Feeds ────────────────────────────────────────

export type SourceTierCode = 'T1' | 'T2' | 'T3';

export interface RssFeedConfig {
  readonly name: string;
  readonly url: string;
  readonly defaultTopic?: string;
  readonly tier?: SourceTierCode;
}

const T1_AUTHORITY_FEEDS: RssFeedConfig[] = [
  {
    name: 'Anthropic Research',
    url: 'https://www.anthropic.com/feed',
    defaultTopic: 'AI',
    tier: 'T1',
  },
  {
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog/rss.xml',
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
];

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
    url: 'https://supabase.com/blog/rss.xml',
    defaultTopic: 'Backend',
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
