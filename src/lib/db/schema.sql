-- Radar Content — D1 Database Schema
-- Run with: wrangler d1 execute radar-content-db --local --file=./src/lib/db/schema.sql

-- Raw crawled articles
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  body TEXT,
  author TEXT,
  published_at INTEGER,
  crawled_at INTEGER NOT NULL DEFAULT (unixepoch()),
  processed INTEGER DEFAULT 0
);

-- LLM-extracted structured data
CREATE TABLE IF NOT EXISTS extractions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id),
  summary TEXT NOT NULL,
  evidence TEXT,
  counter TEXT,
  context TEXT,
  verification_questions TEXT,
  extracted_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Named entities (technologies, people, companies)
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT,
  first_seen INTEGER DEFAULT (unixepoch()),
  article_count INTEGER DEFAULT 0
);

-- Entity co-occurrence graph edges
CREATE TABLE IF NOT EXISTS edges (
  source_entity TEXT NOT NULL REFERENCES entities(id),
  target_entity TEXT NOT NULL REFERENCES entities(id),
  weight REAL DEFAULT 1.0,
  PRIMARY KEY (source_entity, target_entity)
);

-- Topic clusters (from Leiden algorithm)
CREATE TABLE IF NOT EXISTS clusters (
  id TEXT PRIMARY KEY,
  label TEXT,
  topic_tags TEXT,
  score REAL DEFAULT 0,
  status TEXT DEFAULT 'LEAD',
  article_count INTEGER DEFAULT 0,
  source_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Cluster-article membership
CREATE TABLE IF NOT EXISTS cluster_articles (
  cluster_id TEXT NOT NULL REFERENCES clusters(id),
  article_id TEXT NOT NULL REFERENCES articles(id),
  PRIMARY KEY (cluster_id, article_id)
);

-- Article-entity membership
CREATE TABLE IF NOT EXISTS article_entities (
  article_id TEXT NOT NULL REFERENCES articles(id),
  entity_id TEXT NOT NULL REFERENCES entities(id),
  PRIMARY KEY (article_id, entity_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source);
CREATE INDEX IF NOT EXISTS idx_articles_processed ON articles(processed);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_clusters_status ON clusters(status);
CREATE INDEX IF NOT EXISTS idx_clusters_score ON clusters(score DESC);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_article_entities_entity ON article_entities(entity_id);

-- Daily top-12 mock snapshot for guests
CREATE TABLE IF NOT EXISTS mock_snapshot (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  sync_date TEXT NOT NULL
);

-- On-demand translations cache for cards
CREATE TABLE IF NOT EXISTS card_translations (
  card_id TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  lang TEXT NOT NULL DEFAULT 'vi',
  summary TEXT NOT NULL,
  evidence TEXT NOT NULL,
  counter TEXT NOT NULL,
  context TEXT NOT NULL,
  verification_questions TEXT NOT NULL,
  translated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (card_id, lang)
);

