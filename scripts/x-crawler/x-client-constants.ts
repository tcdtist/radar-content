export const BEARER_TOKEN =
  'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

export const GQL_URL = 'https://x.com/i/api/graphql';
export const OP_USER_BY_SCREEN_NAME = 'sLVLhk0bGj3MVFEKTdax1w/UserByScreenName';
export const OP_FOLLOWING = 'qGZZDF3mp91q7X22s3HxpA/Following';
export const OP_USER_TWEETS = 'SXVCYB8XHSS25nzIljNtZA/UserTweets';
export const OP_TWEET_DETAIL = 'XMOz5h24KAZ86qKffKTLdQ/TweetDetail';

export const DEFAULT_FEATURES: Record<string, boolean> = {
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  longform_notetweets_consumption_enabled: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
};
