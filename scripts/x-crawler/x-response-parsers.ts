import { XComment, XTweet, XUser } from './types';

/**
 * Parse UserByScreenName GraphQL response into XUser.
 */
export function parseUserProfileResponse(
  data: Record<string, unknown>,
  screenName: string
): XUser {
  const result = (data as {
    data?: {
      user?: {
        result?: {
          rest_id?: string;
          legacy?: {
            name?: string;
            description?: string;
            followers_count?: number;
            friends_count?: number;
            statuses_count?: number;
          };
        };
      };
    };
  })?.data?.user?.result;

  const legacy = result?.legacy || {};

  return {
    id: result?.rest_id || `user_${screenName}`,
    screenName,
    name: legacy.name || screenName,
    description: legacy.description || '',
    followersCount: legacy.followers_count || 0,
    followingCount: legacy.friends_count || 0,
    statusesCount: legacy.statuses_count || 0,
  };
}

/**
 * Parse Following list GraphQL response into XUser[].
 */
export function parseFollowingResponse(data: Record<string, unknown>): XUser[] {
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
                      user_results?: {
                        result?: {
                          __typename?: string;
                          rest_id?: string;
                          core?: { name?: string; screen_name?: string };
                          legacy?: {
                            name?: string;
                            screen_name?: string;
                            description?: string;
                            followers_count?: number;
                            friends_count?: number;
                            statuses_count?: number;
                          };
                          profile_bio?: { description?: string };
                          relationship_counts?: { followers?: number; following?: number };
                          tweet_counts?: { tweets?: number; statuses_count?: number };
                        };
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

  const users: XUser[] = [];

  for (const inst of instructions) {
    if (inst.type === 'TimelineAddEntries' && Array.isArray(inst.entries)) {
      for (const entry of inst.entries) {
        const res = entry.content?.itemContent?.user_results?.result;
        if (res && res.__typename === 'User') {
          const screenName = res.core?.screen_name || res.legacy?.screen_name;
          const name = res.core?.name || res.legacy?.name || screenName;
          const description = res.profile_bio?.description || res.legacy?.description || '';
          const followers = res.relationship_counts?.followers || res.legacy?.followers_count || 0;
          const following = res.relationship_counts?.following || res.legacy?.friends_count || 0;
          const statuses = res.tweet_counts?.tweets || res.tweet_counts?.statuses_count || 100;

          if (screenName) {
            users.push({
              id: res.rest_id || `user_${screenName}`,
              screenName,
              name: name || screenName,
              description,
              followersCount: followers,
              followingCount: following,
              statusesCount: statuses,
            });
          }
        }
      }
    }
  }

  return users;
}

/**
 * Parse UserTweets GraphQL response into XTweet[].
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
                        result?: {
                          legacy?: {
                            id_str?: string;
                            full_text?: string;
                            created_at?: string;
                            reply_count?: number;
                            retweet_count?: number;
                            favorite_count?: number;
                            in_reply_to_status_id_str?: string | null;
                          };
                        };
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
        const tRes = entry.content?.itemContent?.tweet_results?.result;
        const legacy = tRes?.legacy;
        if (legacy?.full_text && legacy.id_str) {
          tweets.push({
            id: legacy.id_str,
            text: legacy.full_text,
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
                      result?: {
                        legacy?: {
                          id_str?: string;
                          full_text?: string;
                          favorite_count?: number;
                          created_at?: string;
                        };
                        core?: {
                          user_results?: {
                            result?: {
                              core?: { name?: string; screen_name?: string };
                              legacy?: { name?: string; screen_name?: string };
                            };
                          };
                        };
                      };
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
            const res = itm.item?.itemContent?.tweet_results?.result;
            const legacy = res?.legacy;
            const userRes = res?.core?.user_results?.result;
            const author = userRes?.core?.screen_name || userRes?.legacy?.screen_name;
            const authorName = userRes?.core?.name || userRes?.legacy?.name || author;

            if (legacy?.full_text && author && legacy.id_str && legacy.id_str !== tweetId) {
              comments.push({
                id: legacy.id_str,
                text: legacy.full_text,
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
