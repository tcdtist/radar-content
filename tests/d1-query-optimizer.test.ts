import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const SCHEMA_PATH = path.resolve(__dirname, '../src/lib/db/schema.sql');

function runSqliteExplain(schemaSql: string, query: string): string {
  const fullSql = `${schemaSql}\nEXPLAIN QUERY PLAN ${query};\n`;
  return execFileSync('sqlite3', [':memory:'], {
    input: fullSql,
    encoding: 'utf-8',
  });
}

describe('Empirical D1 SQLite Query Optimizer & Index Verification', () => {
  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');

  it('proves all critical indexes exist in schema.sql', () => {
    const listIndexesSql = `${schemaSql}\nSELECT name FROM sqlite_master WHERE type='index';\n`;
    const indexesOutput = execFileSync('sqlite3', [':memory:'], {
      input: listIndexesSql,
      encoding: 'utf-8',
    });

    expect(indexesOutput).toContain('idx_extractions_article_id');
    expect(indexesOutput).toContain('idx_cluster_articles_article');
    expect(indexesOutput).toContain('idx_clusters_label');
    expect(indexesOutput).toContain('idx_articles_crawled');
  });

  it('proves queryCards uses idx_extractions_article_id and does NOT SCAN extractions', () => {
    const queryCardsSql = `
      SELECT a.id, a.title, a.url, a.source, a.author, a.published_at, a.crawled_at,
             e.summary, e.evidence, e.counter, e.context, e.verification_questions
      FROM cluster_articles ca
      JOIN articles a ON ca.article_id = a.id
      LEFT JOIN extractions e ON a.id = e.article_id
      WHERE ca.cluster_id = 'cluster_test'
      ORDER BY a.published_at DESC, a.crawled_at DESC
      LIMIT 10
    `;

    const plan = runSqliteExplain(schemaSql, queryCardsSql);

    // Must search extractions via index, never SCAN
    expect(plan).toContain('SEARCH e USING INDEX idx_extractions_article_id (article_id=?)');
    expect(plan).not.toMatch(/SCAN e\b/);
  });

  it('proves pruneStaleData uses covering index and does NOT perform correlated SCAN', () => {
    const pruneQuery = `
      DELETE FROM articles
      WHERE crawled_at < 1789720000
        AND NOT EXISTS (
          SELECT 1 FROM cluster_articles WHERE cluster_articles.article_id = articles.id
        )
    `;

    const plan = runSqliteExplain(schemaSql, pruneQuery);

    // Must search articles by crawled index and cluster_articles by article_id index
    expect(plan).toContain('SEARCH articles USING INDEX idx_articles_crawled');
    expect(plan).toContain('SEARCH cluster_articles USING COVERING INDEX idx_cluster_articles_article');
    expect(plan).not.toMatch(/SCAN cluster_articles\b/);
  });

  it('proves cluster label deduplication uses idx_clusters_label', () => {
    const labelQuery = `SELECT id FROM clusters WHERE label = 'AI Topic' AND id != 'cluster_123' LIMIT 1`;
    const plan = runSqliteExplain(schemaSql, labelQuery);

    expect(plan).toContain('SEARCH clusters USING INDEX idx_clusters_label');
    expect(plan).not.toMatch(/SCAN clusters\b/);
  });

  it('fault injection: proves missing index triggers SCAN e (anti-tautology regression gate)', () => {
    // Strip idx_extractions_article_id from schema
    const defectiveSchema = schemaSql.replace(
      /CREATE INDEX IF NOT EXISTS idx_extractions_article_id[^;]+;/g,
      ''
    );

    const queryCardsSql = `
      SELECT a.id, e.summary
      FROM cluster_articles ca
      JOIN articles a ON ca.article_id = a.id
      LEFT JOIN extractions e ON a.id = e.article_id
      WHERE ca.cluster_id = 'cluster_test'
    `;

    const defectivePlan = runSqliteExplain(defectiveSchema, queryCardsSql);

    // Demonstrates that without this index, SQLite reverts to SCAN e
    expect(defectivePlan).toMatch(/SCAN e\b/);
  });
});
