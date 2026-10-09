export interface TweetResultNode {
  __typename?: string;
  tweet?: TweetResultNode;
  legacy?: {
    id_str?: string;
    full_text?: string;
    created_at?: string;
    reply_count?: number;
    retweet_count?: number;
    favorite_count?: number;
    in_reply_to_status_id_str?: string | null;
  };
  note_tweet?: {
    note_tweet_results?: {
      result?: {
        text?: string;
      };
    };
  };
  core?: {
    user_results?: {
      result?: {
        core?: { name?: string; screen_name?: string };
        legacy?: { name?: string; screen_name?: string };
      };
    };
  };
}

/**
 * Unwrap TweetWithVisibilityResults wrapper down to the underlying Tweet node.
 */
export function unwrapTweetResult(raw: unknown): TweetResultNode | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  let current = raw as TweetResultNode;
  while (current?.__typename === 'TweetWithVisibilityResults' && current.tweet) {
    current = current.tweet;
  }
  return current;
}

/**
 * Extract full text of a tweet, prioritizing longform note_tweet text over truncated legacy full_text.
 */
export function extractTweetText(node: TweetResultNode): string {
  const noteText = node.note_tweet?.note_tweet_results?.result?.text;
  if (typeof noteText === 'string' && noteText.trim().length > 0) {
    return noteText;
  }
  return node.legacy?.full_text || '';
}
