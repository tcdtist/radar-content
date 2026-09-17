import * as fs from 'fs';
import * as path from 'path';
import { filterActiveTopicUsers, loadCachedRoster, saveCachedRoster } from './filter-roster';
import { formatTweetToPost } from './format-post';
import { CrawlerOptions, FormattedPost, XUser } from './types';
import { XApiClient } from './x-api-client';

/**
 * Helper to parse simple .env or .dev.vars files without extra dependencies.
 */
function loadEnvFile(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) return;
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (err) {
    console.warn(`Could not read env file ${filePath}:`, err);
  }
}

// Load env vars from .dev.vars or .env
loadEnvFile(path.resolve(process.cwd(), '.dev.vars'));
loadEnvFile(path.resolve(process.cwd(), '.env'));

function parseArgs(): CrawlerOptions {
  const args = process.argv.slice(2);
  const options: CrawlerOptions = {
    seedUser: 'goon_nguyen',
    limit: 5,
    dryRun: false,
    mock: false,
    apiUrl: 'http://localhost:8787/api/ingest',
    processNow: false,
    authToken: process.env.X_AUTH_TOKEN,
    ct0: process.env.X_CT0,
  };

  for (const arg of args) {
    if (arg.startsWith('--seed=')) options.seedUser = arg.split('=')[1];
    if (arg.startsWith('--limit=')) options.limit = parseInt(arg.split('=')[1], 10) || 5;
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--mock') options.mock = true;
    if (arg.startsWith('--api-url=')) options.apiUrl = arg.split('=')[1];
    if (arg === '--process-now') options.processNow = true;
    if (arg.startsWith('--auth-token=')) options.authToken = arg.split('=')[1];
    if (arg.startsWith('--ct0=')) options.ct0 = arg.split('=')[1];
  }

  return options;
}

async function main(): Promise<void> {
  const opts = parseArgs();
  console.log('📡 [X-Crawler] Starting 100% Free DIY Twitter Harvester...');
  console.log(`👤 Seed Account: @${opts.seedUser}`);
  console.log(`🎯 Limit: ${opts.limit} users | Dry Run: ${opts.dryRun} | Mock Mode: ${opts.mock}`);

  const client = new XApiClient({
    authToken: opts.authToken,
    ct0: opts.ct0,
    isMock: opts.mock,
  });

  // Step 1: Discover & Filter Following Roster
  let roster: XUser[] | null = loadCachedRoster(opts.seedUser);

  if (!roster || roster.length === 0) {
    console.log(`🔍 Cache miss. Resolving seed profile @${opts.seedUser}...`);
    const seedProfile = await client.getUserProfile(opts.seedUser);
    console.log(`✅ Seed found: "${seedProfile.name}" (${seedProfile.followingCount} following)`);

    console.log('📥 Fetching following list...');
    const rawFollowing = await client.getFollowingList(seedProfile, 40);
    console.log(`📊 Retrieved ${rawFollowing.length} accounts. Filtering active tech/AI builders...`);

    roster = filterActiveTopicUsers(rawFollowing);
    saveCachedRoster(opts.seedUser, roster);
    console.log(`💾 Filtered & cached ${roster.length} high-signal topic builders.`);
  } else {
    console.log(`⚡ Loaded ${roster.length} curated accounts from local cache.`);
  }

  // Step 2: Fetch Tweets and Top Discussion Comments
  const targetUsers = roster.slice(0, opts.limit);
  const postsToIngest: FormattedPost[] = [];

  for (const user of targetUsers) {
    console.log(`\n🔎 Scanning @${user.screenName} (${user.topicTags?.join(', ') || 'Tech'})...`);
    const allTweets = await client.getUserTweets(user.screenName, 5);
    const originalTweets = allTweets.filter((t) => !t.text.startsWith('RT @')).slice(0, 2);
    console.log(`  Found ${allTweets.length} tweets (${originalTweets.length} original non-RTs).`);

    for (const tweet of originalTweets) {
      const comments = await client.getTweetComments(tweet.id);
      const post = formatTweetToPost(tweet, comments);
      postsToIngest.push(post);
      console.log(`  ➕ Captured: "${post.title.slice(0, 50)}..." (${comments.length} comments)`);
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
