/**
 * Data retention and auto-pruning logic for Radar Content.
 * Rules:
 * 1. Absolute Immunity: Clusters with status 'SAVED' or 'WRITTEN' are NEVER deleted.
 * 2. Prune dismissed clusters older than 14 days.
 * 3. Prune stale lead clusters older than 30 days.
 * 4. Prune unlinked raw articles older than 7 days.
 * 5. Clean up orphaned join table and extraction records.
 */

export interface PruneStats {
  prunedClusters: number;
  prunedArticles: number;
  prunedExtractions: number;
}

export async function pruneStaleData(
  db: D1Database,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<PruneStats> {
  const dismissedThreshold = nowSeconds - 14 * 86400; // 14 days
  const leadThreshold = nowSeconds - 30 * 86400; // 30 days
  const articleThreshold = nowSeconds - 7 * 86400; // 7 days

  let prunedClusters = 0;
  let prunedArticles = 0;
  let prunedExtractions = 0;

  try {
    // 1. Delete dismissed clusters older than 14 days (SAVED & WRITTEN strictly immune)
    const delDismissed = await db
      .prepare("DELETE FROM clusters WHERE status = 'DISMISSED' AND updated_at < ?")
      .bind(dismissedThreshold)
      .run();
    prunedClusters += delDismissed?.meta?.changes ?? 0;

    // 2. Delete stale LEAD clusters older than 30 days (SAVED & WRITTEN strictly immune)
    const delLeads = await db
      .prepare("DELETE FROM clusters WHERE status = 'LEAD' AND updated_at < ?")
      .bind(leadThreshold)
      .run();
    prunedClusters += delLeads?.meta?.changes ?? 0;

    // 3. Clean up orphaned cluster_articles join records
    await db
      .prepare('DELETE FROM cluster_articles WHERE cluster_id NOT IN (SELECT id FROM clusters)')
      .run();

    // 4. Delete unlinked raw articles older than 7 days
    const delArticles = await db
      .prepare(
        `DELETE FROM articles
         WHERE crawled_at < ?
           AND NOT EXISTS (
             SELECT 1 FROM cluster_articles WHERE cluster_articles.article_id = articles.id
           )`
      )
      .bind(articleThreshold)
      .run();
    prunedArticles += delArticles?.meta?.changes ?? 0;

    // 5. Clean up orphaned extractions
    const delExtractions = await db
      .prepare(
        `DELETE FROM extractions
         WHERE NOT EXISTS (
           SELECT 1 FROM articles WHERE articles.id = extractions.article_id
         )`
      )
      .run();
    prunedExtractions += delExtractions?.meta?.changes ?? 0;

    console.log(
      `[Prune] Pruning completed: ${prunedClusters} clusters, ${prunedArticles} articles, ${prunedExtractions} extractions.`
    );
  } catch (err) {
    console.error('[Prune] Error during data pruning:', err);
  }

  return { prunedClusters, prunedArticles, prunedExtractions };
}
