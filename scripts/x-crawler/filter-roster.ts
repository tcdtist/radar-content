import * as fs from 'fs';
import * as path from 'path';
import { CuratedRosterFile, XUser } from './types';

const TECH_TOPIC_KEYWORDS = [
  'ai',
  'llm',
  'agent',
  'gpt',
  'claude',
  'machine learning',
  'deep learning',
  'nlp',
  'engineer',
  'developer',
  'software',
  'systems',
  'infra',
  'distributed',
  'backend',
  'cloud',
  'rust',
  'typescript',
  'golang',
  'python',
  'database',
  'sqlite',
  'architecture',
  'founder',
  'cto',
  'building',
  'indie',
  'solopreneur',
  'ship',
  'product',
];

const ROSTER_CACHE_PATH = path.resolve(process.cwd(), 'scripts/x-crawler/roster-cache.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Filter users who have clear tech/AI/builder topics and active posting history.
 */
export function filterActiveTopicUsers(users: XUser[]): XUser[] {
  return users.filter((user) => {
    // 1. Must have minimum activity history
    if (user.statusesCount < 20) return false;

    // 2. Check topic relevance from bio
    const bio = (user.description || '').toLowerCase();
    const matchedTopics: string[] = [];

    for (const kw of TECH_TOPIC_KEYWORDS) {
      const regex = new RegExp(`\\b${kw}(?:s|ing)?\\b`, 'i');
      if (regex.test(bio)) {
        matchedTopics.push(kw);
      }
    }

    if (matchedTopics.length > 0) {
      user.topicTags = Array.from(new Set(matchedTopics));
      return true;
    }

    return false;
  });
}

/**
 * Read cached curated roster if available and valid.
 */
export function loadCachedRoster(seedUser: string): XUser[] | null {
  try {
    if (!fs.existsSync(ROSTER_CACHE_PATH)) return null;
    const content = fs.readFileSync(ROSTER_CACHE_PATH, 'utf-8');
    const data = JSON.parse(content) as CuratedRosterFile;

    if (data.seedUser === seedUser && Date.now() - data.updatedAt < CACHE_TTL_MS) {
      return data.users;
    }
  } catch (err) {
    console.warn('[Roster Cache] Failed to load cache:', err);
  }
  return null;
}

/**
 * Persist curated roster to disk.
 */
export function saveCachedRoster(seedUser: string, users: XUser[]): void {
  try {
    const data: CuratedRosterFile = {
      seedUser,
      updatedAt: Date.now(),
      users,
    };
    fs.writeFileSync(ROSTER_CACHE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Roster Cache] Failed to save cache:', err);
  }
}
