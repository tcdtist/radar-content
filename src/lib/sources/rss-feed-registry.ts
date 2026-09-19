/**
 * Curated RSS/Atom Feed Registry — Organized by Source Tier
 *
 * Tier 1 (Authority): Official Engineering Blogs from AI Labs & Core Infra
 * Tier 2 (Depth): Developer Platforms, GitHub Releases, Research
 * Tier 3 (Reference): General Tech News Aggregators
 */

import { SourceTier } from '../scoring/source-tiers';

export interface RssFeedConfig {
  name: string;
  url: string;
  defaultTopic?: string;
  tier?: SourceTier;
}

// ── Tier 1: Authority (AI Labs & Core Engineering Blogs) ──────────────

const T1_AUTHORITY_FEEDS: RssFeedConfig[] = [
  {
    name: 'Anthropic Research',
    url: 'https://www.anthropic.com/feed',
    defaultTopic: 'AI',
    tier: SourceTier.T1_AUTHORITY,
  },
  {
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog/rss.xml',
    defaultTopic: 'AI',
    tier: SourceTier.T1_AUTHORITY,
  },
  {
    name: 'Cloudflare Blog',
    url: 'https://blog.cloudflare.com/rss/',
    defaultTopic: 'Cloud/DevOps',
    tier: SourceTier.T1_AUTHORITY,
  },
  {
    name: 'Simon Willison AI Weblog',
    url: 'https://simonwillison.net/atom/everything/',
    defaultTopic: 'AI',
    tier: SourceTier.T1_AUTHORITY,
  },
];

// ── Tier 2: Depth (Developer Platforms & GitHub Releases) ─────────────

const T2_DEPTH_FEEDS: RssFeedConfig[] = [
  {
    name: 'Hugging Face Blog',
    url: 'https://huggingface.co/blog/feed.xml',
    defaultTopic: 'AI',
    tier: SourceTier.T2_DEPTH,
  },
  {
    name: 'Vercel Blog',
    url: 'https://vercel.com/atom',
    defaultTopic: 'Frontend',
    tier: SourceTier.T2_DEPTH,
  },
  {
    name: 'Supabase Blog',
    url: 'https://supabase.com/blog/rss.xml',
    defaultTopic: 'Backend',
    tier: SourceTier.T2_DEPTH,
  },
  {
    name: 'Bun Releases',
    url: 'https://github.com/oven-sh/bun/releases.atom',
    defaultTopic: 'Backend',
    tier: SourceTier.T2_DEPTH,
  },
  {
    name: 'Vercel AI SDK Releases',
    url: 'https://github.com/vercel/ai/releases.atom',
    defaultTopic: 'AI',
    tier: SourceTier.T2_DEPTH,
  },
];

// ── Tier 3: Reference (General Tech News) ─────────────────────────────

const T3_REFERENCE_FEEDS: RssFeedConfig[] = [
  {
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    defaultTopic: 'AI',
    tier: SourceTier.T3_REFERENCE,
  },
];

// ── Combined registry (order: T1 first → T2 → T3) ────────────────────

export const CURATED_TECH_FEEDS: RssFeedConfig[] = [
  ...T1_AUTHORITY_FEEDS,
  ...T2_DEPTH_FEEDS,
  ...T3_REFERENCE_FEEDS,
];
