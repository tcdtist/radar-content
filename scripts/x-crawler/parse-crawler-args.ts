import * as fs from 'fs';
import * as path from 'path';
import { INNER_CIRCLE_X_SEEDS } from '../../src/lib/sources/curated-sources';
import { parseSeedUsers } from './filter-roster';
import { CrawlerOptions } from './types';

/**
 * Helper to parse simple .env or .dev.vars files without extra dependencies.
 */
export function loadEnvFile(filePath: string): void {
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
  } catch {
    // Non-fatal if config fails to load
  }
}

/**
 * Parse CLI arguments and environment variables for X Crawler.
 */
export function parseCrawlerArgs(argv = process.argv.slice(2)): CrawlerOptions {
  loadEnvFile(path.resolve(process.cwd(), '.dev.vars'));
  loadEnvFile(path.resolve(process.cwd(), '.env'));

  const envSeeds = process.env.SEED_USERS || process.env.X_SEED_USERS || process.env.SEED_USER;
  const initialSeeds = envSeeds ? parseSeedUsers(envSeeds) : [...INNER_CIRCLE_X_SEEDS];

  const options: CrawlerOptions = {
    seedUsers: initialSeeds,
    seedUser: initialSeeds[0] || 'goon_nguyen',
    limit: 5,
    includeSeed: true,
    includeFollowing: true,
    dryRun: false,
    mock: false,
    apiUrl: 'http://localhost:8787/api/ingest',
    processNow: false,
    authToken: process.env.X_AUTH_TOKEN,
    ct0: process.env.X_CT0,
  };

  for (const arg of argv) {
    if (arg.startsWith('--seeds=') || arg.startsWith('--seed=')) {
      options.seedUsers = parseSeedUsers(arg.split('=')[1]);
      options.seedUser = options.seedUsers[0];
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10) || 5;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--mock') {
      options.mock = true;
    } else if (arg.startsWith('--api-url=')) {
      options.apiUrl = arg.split('=')[1];
    } else if (arg === '--process-now') {
      options.processNow = true;
    } else if (arg.startsWith('--auth-token=')) {
      options.authToken = arg.split('=')[1];
    } else if (arg.startsWith('--ct0=')) {
      options.ct0 = arg.split('=')[1];
    } else if (arg === '--skip-seed' || arg === '--no-seed') {
      options.includeSeed = false;
    } else if (arg === '--direct-only') {
      options.includeFollowing = false;
    }
  }

  return options;
}
