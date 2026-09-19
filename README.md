<p align="center">
  <img src="assets/cover.png" alt="Radar Content Banner" width="100%" />
</p>

<h1 align="center">Radar Content</h1>

<p align="center">
  <b>Serverless Content Intelligence Engine & Topic Radar — Zero-Cost, Edge-Native, Self-Hosted.</b>
</p>

<p align="center">
  <a href="https://github.com/tcdtist/radar-content/actions"><img src="https://img.shields.io/badge/CI-Passing-2ea44f?style=flat-square" alt="CI Status" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Strict-3178c6?style=flat-square" alt="TypeScript Strict" /></a>
  <a href="https://workers.cloudflare.com/"><img src="https://img.shields.io/badge/Cloudflare-Workers%20%26%20D1-f38020?style=flat-square" alt="Cloudflare" /></a>
  <a href="https://vitest.dev/"><img src="https://img.shields.io/badge/Tests-165%20Passed-6e9f18?style=flat-square" alt="Vitest" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/Infra%20Cost-%240%20%2F%20mo-brightgreen?style=flat-square" alt="Zero Cost" />
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#core-capabilities">Capabilities</a> •
  <a href="#source-priority-tiering">Source Tiers</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#tech-stack">Tech Stack</a>
</p>

---

## Overview

**Radar Content** is a self-hosted content intelligence engine that continuously ingests, structures, and scores technical discussions from multiple distributed sources (Reddit, Hacker News, Lobsters, X/Twitter, and engineering blogs).

Unlike conventional RSS readers or news aggregators that dump unvetted feeds, Radar Content extracts **structured argumentation graphs** — claims, evidence, counterpoints, and verification questions — and clusters related discussions across platforms using the **Leiden community detection algorithm** to surface high-signal insights for content creators and engineering leaders.

### Core Value Proposition

- **Evidence Over Noise** — Most aggregators forward unverified claims. Radar Content isolates concrete evidence points and skeptical counterarguments before scoring.
- **Identity-Based Authority** — Ranks content by author credibility (researchers, compiler engineers, core maintainers) rather than viral crowd metrics (likes, retweets).
- **Graph-Powered Narrative Clustering** — Connects fragmented discussions across different platforms into unified topic intelligence cards.
- **Actionable Intelligence Cards** — Each card answers four critical editorial questions: *What happened? What is the proof? Who disagrees? Is it worth writing about?*
- **Zero Operating Cost** — Runs completely serverless on Cloudflare's generous free tier (Workers, D1, Queues, Pages) and Google Gemini Flash API's free daily quota.

---

## Core Capabilities

### 1. Ingestion & Graph Intelligence
- **Multi-Source Edge Crawling** — Automated cron ingestion targeting Reddit (`r/LocalLLaMA`, `r/MachineLearning`), Hacker News, Lobsters, X/Twitter, and curated tech RSS/Atom feeds.
- **Structured Argument Mining** — LLM-driven decomposition of content into `Summary`, `Evidence`, `Counter`, `Context`, and `Verification Questions`.
- **Leiden Community Detection** — High-performance TypeScript implementation of the Leiden graph algorithm to identify cross-platform topical clusters without central server overhead.

### 2. Identity-Based Authority Engine
- **Three-Tier Source Hierarchy** — Differentiates primary builder signals from secondary commentary and general community chatter.
- **Subdomain-Safe Dynamic Elevation** — Elevates verified engineering feeds (e.g., `blog.cloudflare.com`, `anthropic.com`) from reference tier directly to top authority tier.
- **Composite Scoring Matrix** — Multi-factor weighting combining Source Diversity (20%), Authority (20%), Evidence Density (30%), Community Engagement (15%), and Recency (15%).
- **Automated Promotion Pipeline** — Automatically elevates topic clusters with primary-source backing (weight ≥ 0.75) and verified evidence (≥ 2 points) from `LEAD` to `READY` status.

### 3. Creator Workflow & Dashboard
- **Lifecycle Pipeline Management** — Five-stage state machine (`LEAD`, `READY`, `SAVED`, `WRITTEN`, `DISMISSED`) tailored for production editorial schedules.
- **Precision Tier Filtering** — Instant dropdown filtering by source tier (`All Tiers`, `T1 Inner Circle`, `T1 + T2 Verified`).
- **Interactive Workspace** — Responsive slide-in inspection drawer, citation explorer, one-click Markdown brief exports, and on-demand technical Vietnamese translation.
- **Adaptive Visual Themes** — Native dark and light modes styled with tailored HSL tokens (Midnight Slate and Vintage Paper).

---

## Source Priority Tiering

Radar Content prioritizes domain credentials and empirical rigor over crowd volume. A release analysis by a core compiler maintainer carries substantially more weight than speculative forum threads.

| Tier | Classification | Weight | Primary Sources | Role in Intelligence Pipeline |
|---|---|---|---|---|
| `T1` | **Authority / Inner Circle** | `1.00` | • **X Inner Circle**: Verified AI researchers and systems builders (Karpathy, Swyx, Simon Willison, Rauch, Sumner, etc.)<br>• **Official Research/Eng Blogs**: Anthropic, OpenAI, Cloudflare, DeepSeek, Google Research, Meta AI | Primary source signals, foundational discoveries, and architectural disclosures. |
| `T2` | **Depth / Technical Discourse** | `0.75` | • **Curated Communities**: Hacker News, Lobsters<br>• **Ecosystem Engineering**: Vercel, Supabase, Hugging Face, PyTorch, GitHub Releases Atom feeds | Technical debates, peer critiques, benchmark reproductions, and ecosystem changelogs. |
| `T3` | **Reference / Broad Pulse** | `0.40` | • **Community Forums**: Reddit (`r/LocalLLaMA`, `r/MachineLearning`)<br>• **General Tech Feeds**: Standard RSS news syndication | Sentiment tracking, community pulse, and peripheral discussion context. |

### Dynamic Domain Elevation
Feed URLs are validated against a strict domain whitelist using exact-match and subdomain-boundary checks (`matchDomain`). Articles from official labs (e.g., `blog.cloudflare.com` or `anthropic.com`) are automatically promoted from **T3 to T1**, while developer platform announcements (e.g., `vercel.com`, `supabase.com`) are promoted to **T2**.

### Scoring & Auto-Promotion Engine
Cards receive a composite score from 0 to 100 based on the following formula:

```text
Score = (0.20 × Diversity) + (0.20 × Authority) + (0.30 × Evidence) + (0.15 × Engagement) + (0.15 × Recency)
```

- **Auto-Promotion Gate**: Clusters with **≥ 1 Tier 1/2 source (weight ≥ 0.75)** and **≥ 2 verified evidence points** automatically advance to `READY` status.
- **Tier Filtering**: Creators can isolate high-signal discussions directly through the dashboard filter: `All Tiers`, `T1 Inner Circle`, or `T1 + T2 Verified`.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE EDGE                           │
│                                                                  │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐    │
│  │ Cron Trigger │───▶│   Workers    │───▶│   Queues/Jobs    │    │
│  │ (15-30 min)  │    │  (Hono API)  │    │  (Rate Limiter)  │    │
│  └─────────────┘    └──────┬───────┘    └───────┬──────────┘    │
│                            │                     │               │
│                            ▼                     ▼               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                     D1 Database                          │    │
│  │  ┌──────────┐ ┌────────────┐ ┌───────────┐ ┌─────────┐ │    │
│  │  │ articles │ │  entities  │ │  clusters │ │  edges  │ │    │
│  │  └──────────┘ └────────────┘ └───────────┘ └─────────┘ │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────┐                   │
│  │         Cloudflare Pages (Frontend)       │                   │
│  │         Card-based Dashboard UI           │                   │
│  │  (Tailored HSL Theme: Slate / Paper)     │                   │
│  └──────────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
  ┌──────────────┐                   ┌─────────────────┐
  │ Data Sources  │                   │  Google Gemini   │
  │ Reddit, HN,  │                   │  Flash API      │
  │ X, RSS Feeds │                   │  Daily Free Tier│
  └──────────────┘                   └─────────────────┘
```

---

## Tech Stack

| Layer | Technology | Operational Cost |
|---|---|---|
| **Runtime** | Cloudflare Workers (TypeScript, Hono framework) | Free tier (100,000 req/day) |
| **Database** | Cloudflare D1 (Serverless edge SQLite) | Free tier (5M reads, 100K writes/day) |
| **Queue** | Cloudflare Queues | Free tier (100,000 ops/day) |
| **Frontend** | Cloudflare Pages (Vite + React 18 SPA) | Free unlimited bandwidth |
| **LLM Inference** | Google Gemini Flash API | Free tier daily quota |
| **Graph Intelligence** | Leiden Algorithm (TypeScript implementation) | In-process execution ($0) |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier)
- A [Google AI Studio API key](https://aistudio.google.com/apikey) (free tier)

### Local Development

```bash
# Clone the repository
git clone https://github.com/tcdtist/radar-content.git
cd radar-content

# Install dependencies
npm install

# Set up local environment variables
cp .dev.vars.example .dev.vars
# Add your GEMINI_API_KEY into .dev.vars

# Initialize local D1 database schema
wrangler d1 execute radar-content-db --local --file=src/lib/db/schema.sql

# Start development server
npm run dev
```

### Production Deployment

```bash
# Authenticate with Cloudflare
wrangler login

# Provision production D1 database
wrangler d1 create radar-content-db
# Copy the returned database_id into wrangler.toml under [[d1_databases]]

# Apply schema to production D1
wrangler d1 execute radar-content-db --remote --file=src/lib/db/schema.sql

# Store Gemini API key in Worker Secrets
wrangler secret put GEMINI_API_KEY

# Deploy Worker API
wrangler deploy

# Build and deploy frontend to Cloudflare Pages
npm run build
wrangler pages deploy dist --project-name=radar-content
```

---

## Project Structure

```
radar-content/
├── src/
│   ├── workers/          # Edge Worker entry points and API routes
│   ├── lib/              # Core domain logic modules (db, sources, llm, graph, scoring)
│   └── pages/            # Frontend dashboard application (React SPA)
├── tests/                # Vitest unit, integration, and E2E browser test suites
├── docs/                 # System architecture specifications and deployment guides
├── scripts/              # Ingestion automation and verification tools
├── .github/              # GitHub Actions CI/CD workflows and automated AI reviews
├── wrangler.toml         # Cloudflare Workers, D1 database, and cron bindings
├── package.json
└── README.md
```

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more details.
