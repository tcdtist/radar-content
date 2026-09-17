import { RawSourcePost } from '../../src/lib/sources/source-types';
import { XComment, XTweet } from './types';

/**
 * Format tweet and its top discussion comments into a structured RawSourcePost for Radar Content.
 */
export function formatTweetToPost(tweet: XTweet, comments: XComment[] = []): RawSourcePost {
  const cleanTitle = extractTitleFromTweet(tweet.text);

  let body = `${tweet.authorName} (@${tweet.author}):\n${tweet.text.trim()}`;

  if (comments.length > 0) {
    body += '\n\n--- Community Discussion & Counterpoints ---\n';
    for (const c of comments) {
      body += `- @${c.author} (${c.likeCount} likes): ${c.text.trim()}\n`;
    }
  }

  const engagementScore = tweet.likeCount + tweet.retweetCount * 2 + tweet.replyCount * 3;

  return {
    source: 'x',
    sourceId: tweet.id,
    url: tweet.url,
    title: cleanTitle,
    body: body.trim(),
    author: `@${tweet.author}`,
    publishedAt: tweet.createdAt,
    engagementScore,
    commentsCount: tweet.replyCount,
  };
}

/**
 * Extract a clean, representative title from the first sentence or 100 chars of a tweet.
 */
export function extractTitleFromTweet(text: string): string {
  const trimmed = text.replace(/https?:\/\/\S+/g, '').trim();
  const firstSentence = trimmed.split(/\n|[.!?]\s/)[0]?.trim() || '';

  if (firstSentence.length >= 15 && firstSentence.length <= 120) {
    return firstSentence;
  }

  if (trimmed.length <= 100) {
    return trimmed || 'X Post Discussion';
  }

  return trimmed.slice(0, 97) + '...';
}
