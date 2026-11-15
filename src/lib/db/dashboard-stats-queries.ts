/**
 * Queries for computing high-level dashboard metrics across articles and clusters.
 */

export async function getDashboardStats(db: D1Database): Promise<{
  totalArticles: number;
  totalClusters: number;
  readyCount: number;
  writtenCount: number;
}> {
  const artCount = await db.prepare('SELECT count(*) as count FROM articles').first<{ count: number }>();
  const cluCount = await db.prepare('SELECT count(*) as count FROM clusters').first<{ count: number }>();
  const ready = await db.prepare("SELECT count(*) as count FROM clusters WHERE status = 'READY'").first<{ count: number }>();
  const written = await db.prepare("SELECT count(*) as count FROM clusters WHERE status = 'WRITTEN'").first<{ count: number }>();

  return {
    totalArticles: artCount?.count ?? 0,
    totalClusters: cluCount?.count ?? 0,
    readyCount: ready?.count ?? 0,
    writtenCount: written?.count ?? 0,
  };
}
