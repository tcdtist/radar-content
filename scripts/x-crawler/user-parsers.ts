import { XUser } from './types';

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
