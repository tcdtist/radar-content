import { RawSourcePost } from '../../src/lib/sources/source-types';

export interface XUser {
  id: string;
  screenName: string;
  name: string;
  description: string;
  followersCount: number;
  followingCount: number;
  statusesCount: number;
  lastTweetAt?: number;
  topicTags?: string[];
}

export interface XTweet {
  id: string;
  text: string;
  author: string;
  authorName: string;
  createdAt: number; // Unix timestamp seconds
  replyCount: number;
  retweetCount: number;
  likeCount: number;
  url: string;
  isRetweet: boolean;
  isReply: boolean;
}

export interface XComment {
  id: string;
  text: string;
  author: string;
  authorName: string;
  likeCount: number;
  createdAt: number;
}

export interface XDiscussionThread {
  tweet: XTweet;
  comments: XComment[];
}

export interface CuratedRosterFile {
  seedUser?: string;
  updatedAt?: number;
  users?: XUser[];
  seeds?: Record<string, { updatedAt: number; users: XUser[] }>;
}

export interface CrawlerOptions {
  seedUsers: string[];
  seedUser?: string;
  limit: number;
  includeSeed: boolean;
  includeFollowing: boolean;
  dryRun: boolean;
  mock: boolean;
  apiUrl: string;
  processNow: boolean;
  authToken?: string;
  ct0?: string;
}

export type FormattedPost = RawSourcePost;
