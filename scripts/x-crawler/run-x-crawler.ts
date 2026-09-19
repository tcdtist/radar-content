import {
  deduplicateUsers,
  filterActiveTopicUsers,
  loadCachedRoster,
  saveCachedRoster,
} from './filter-roster';
import { formatTweetToPost } from './format-post';
import { parseCrawlerArgs } from './parse-crawler-args';
import { FormattedPost, XUser } from './types';
import { XApiClient } from './x-api-client';

async function main(): Promise<void> {
  const opts = parseCrawlerArgs();
  console.log('📡 [X-Crawler] Starting 100% Free DIY Twitter Harvester...');
  console.log(`👤 Seed Accounts: ${opts.seedUsers.map((u) => `@${u}`).join(', ')}`);
  console.log(`🎯 Limit: ${opts.limit} users | Direct Seed: ${opts.includeSeed} | Following: ${opts.includeFollowing} | Mock: ${opts.mock}`);

  const client = new XApiClient({
    authToken: opts.authToken,
    ct0: opts.ct0,
    isMock: opts.mock,
  });

  // Step 1: Discover & Filter Accounts (Seeds + Curated Following Network)
  const candidateUsers: XUser[] = [];

  for (const seedName of opts.seedUsers) {
    console.log(`\n🔍 Processing seed @${seedName}...`);
    let seedProfile: XUser | null = null;
    try {
      seedProfile = await client.getUserProfile(seedName);
      console.log(`✅ Seed resolved: "${seedProfile.name}" (@${seedProfile.screenName})`);
    } catch (err) {
      console.warn(`⚠️ Could not resolve seed @${seedName}:`, err);
    }

    if (opts.includeSeed && seedProfile) {
      candidateUsers.push(seedProfile);
    }

    if (opts.includeFollowing && seedProfile) {
      let cachedFollowing = loadCachedRoster(seedName);
      if (!cachedFollowing || cachedFollowing.length === 0) {
        console.log(`  📥 Fetching following list for @${seedName}...`);
        try {
          const rawFollowing = await client.getFollowingList(seedProfile, 40);
          cachedFollowing = filterActiveTopicUsers(rawFollowing);
          saveCachedRoster(seedName, cachedFollowing);
          console.log(`  💾 Filtered & cached ${cachedFollowing.length} builders for @${seedName}.`);
        } catch (err) {
          console.warn(`  ⚠️ Failed fetching following for @${seedName}:`, err);
          cachedFollowing = [];
        }
      } else {
        console.log(`  ⚡ Loaded ${cachedFollowing.length} accounts from cache for @${seedName}.`);
      }
      candidateUsers.push(...cachedFollowing);
    }
  }

  // Deduplicate across seeds and following networks
  const uniqueUsers = deduplicateUsers(candidateUsers);
  console.log(`\n🎯 Candidate Pool: ${uniqueUsers.length} unique accounts across ${opts.seedUsers.length} seed(s).`);
  const targetUsers = uniqueUsers.slice(0, opts.limit);
  const postsToIngest: FormattedPost[] = [];
  const seenTweetIds = new Set<string>();

  // Step 2: Fetch Tweets and Top Discussion Comments
  for (const user of targetUsers) {
    console.log(`\n🔎 Scanning @${user.screenName} (${user.topicTags?.join(', ') || 'Tech'})...`);
    try {
      const allTweets = await client.getUserTweets(user.screenName, 5);
      const originalTweets = allTweets
        .filter((t) => !t.text.startsWith('RT @'))
        .filter((t) => !seenTweetIds.has(t.id))
        .slice(0, 2);

      console.log(`  Found ${allTweets.length} tweets (${originalTweets.length} original non-RTs).`);

      for (const tweet of originalTweets) {
        seenTweetIds.add(tweet.id);
        const comments = await client.getTweetComments(tweet.id);
        const post = formatTweetToPost(tweet, comments);
        postsToIngest.push(post);
        console.log(`  ➕ Captured: "${post.title.slice(0, 50)}..." (${comments.length} comments)`);
      }
    } catch (err) {
      console.warn(`  ⚠️ Failed fetching tweets for @${user.screenName}:`, err);
    }
  }

  console.log(`\n📦 Total Posts Prepared: ${postsToIngest.length}`);

  // Step 3: Ingestion or Dry Run
  if (opts.dryRun) {
    console.log('\n--- [DRY RUN PREVIEW] ---');
    console.log(JSON.stringify(postsToIngest, null, 2));
    console.log('✅ Dry run completed. No data sent to API.');
    return;
  }

  if (postsToIngest.length === 0) {
    console.log('⚠️ No posts collected to ingest.');
    return;
  }

  console.log(`🚀 Sending payload to Radar Content API: ${opts.apiUrl}...`);
  try {
    const res = await fetch(opts.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        posts: postsToIngest,
        processNow: opts.processNow,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API returned ${res.status}: ${errText}`);
    }

    const json = await res.json();
    console.log('🎉 Ingestion Result:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('❌ Failed to push to Radar Content API:', err);
  }
}

main().catch((err) => {
  console.error('Fatal Crawler Error:', err);
  process.exit(1);
});
