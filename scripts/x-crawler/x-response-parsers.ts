import { XComment, XTweet } from './types';
import { extractTweetText, unwrapTweetResult } from './tweet-unwrapper';

export { parseFollowingResponse, parseUserProfileResponse } from './user-parsers';
export { extractTweetText, unwrapTweetResult } from './tweet-unwrapper';

/**
 * Parse UserTweets GraphQL response into XTweet[].
 * Supports Note Tweets (longform posts) and unwrap of TweetWithVisibilityResults.
 */
export function parseUserTweetsResponse(
  data: Record<string, unknown>,
  screenName: string,
  authorName: string
): XTweet[] {
  const instructions = (data as {
    data?: {
      user?: {
        result?: {
          timeline?: {
            timeline?: {
              instructions?: Array<{
                type?: string;
                entries?: Array<{
                  content?: {
                    itemContent?: {
                      tweet_results?: {
                        result?: unknown;
                      };
                    };
                  };
                }>;
              }>;
            };
          };
        };
      };
    };
  })?.data?.user?.result?.timeline?.timeline?.instructions || [];

  const tweets: XTweet[] = [];

  for (const inst of instructions) {
    if (inst.type === 'TimelineAddEntries' && Array.isArray(inst.entries)) {
      for (const entry of inst.entries) {
        const rawRes = entry.content?.itemContent?.tweet_results?.result;
        const tRes = unwrapTweetResult(rawRes);
        const legacy = tRes?.legacy;
        const text = tRes ? extractTweetText(tRes) : '';

        if (text && legacy?.id_str) {
          tweets.push({
            id: legacy.id_str,
            text,
            author: screenName,
            authorName,
            createdAt: legacy.created_at
              ? Math.floor(new Date(legacy.created_at).getTime() / 1000)
              : Math.floor(Date.now() / 1000),
            replyCount: legacy.reply_count || 0,
            retweetCount: legacy.retweet_count || 0,
            likeCount: legacy.favorite_count || 0,
            url: `https://x.com/${screenName}/status/${legacy.id_str}`,
            isRetweet: false,
            isReply: Boolean(legacy.in_reply_to_status_id_str),
          });
        }
      }
    }
  }

  return tweets;
}

/**
 * Parse TweetDetail response into XComment[].
 * Supports Note Tweets (longform replies) and unwrap of TweetWithVisibilityResults.
 */
export function parseTweetCommentsResponse(
  data: Record<string, unknown>,
  tweetId: string
): XComment[] {
  const instructions = (data as {
    data?: {
      threaded_conversation_with_injections_v2?: {
        instructions?: Array<{
          type?: string;
          entries?: Array<{
            entryId?: string;
            content?: {
              items?: Array<{
                item?: {
                  itemContent?: {
                    tweet_results?: {
                      result?: unknown;
                    };
                  };
                };
              }>;
            };
          }>;
        }>;
      };
    };
  })?.data?.threaded_conversation_with_injections_v2?.instructions || [];

  const comments: XComment[] = [];

  for (const inst of instructions) {
    if (inst.type === 'TimelineAddEntries' && Array.isArray(inst.entries)) {
      for (const entry of inst.entries) {
        if (entry.entryId?.includes('conversationthread') && Array.isArray(entry.content?.items)) {
          for (const itm of entry.content.items) {
            const rawRes = itm.item?.itemContent?.tweet_results?.result;
            const res = unwrapTweetResult(rawRes);
            const legacy = res?.legacy;
            const text = res ? extractTweetText(res) : '';
            const userRes = res?.core?.user_results?.result;
            const author = userRes?.core?.screen_name || userRes?.legacy?.screen_name;
            const authorName = userRes?.core?.name || userRes?.legacy?.name || author;

            if (text && author && legacy?.id_str && legacy.id_str !== tweetId) {
              comments.push({
                id: legacy.id_str,
                text,
                author,
                authorName: authorName || author,
                likeCount: legacy.favorite_count || 0,
                createdAt: legacy.created_at
                  ? Math.floor(new Date(legacy.created_at).getTime() / 1000)
                  : Math.floor(Date.now() / 1000),
              });
            }
          }
        }
      }
    }
  }

  return comments.sort((a, b) => b.likeCount - a.likeCount).slice(0, 5);
}
