import { MOCK_SEED_USERS, MOCK_TWEETS_WITH_COMMENTS } from './mock-data';
import { XComment, XTweet, XUser } from './types';
import {
  BEARER_TOKEN,
  DEFAULT_FEATURES,
  GQL_URL,
  OP_FOLLOWING,
  OP_TWEET_DETAIL,
  OP_USER_BY_SCREEN_NAME,
  OP_USER_TWEETS,
} from './x-client-constants';
import {
  parseFollowingResponse,
  parseTweetCommentsResponse,
  parseUserProfileResponse,
  parseUserTweetsResponse,
} from './x-response-parsers';

export interface XClientConfig {
  authToken?: string;
  ct0?: string;
  isMock?: boolean;
}

export class XApiClient {
  private authToken: string;
  private ct0: string;
  private isMock: boolean;

  constructor(config: XClientConfig) {
    this.authToken = config.authToken || '';
    this.ct0 = config.ct0 || '';
    this.isMock = Boolean(config.isMock || (!this.authToken && !this.ct0));
  }

  private getHeaders(): Record<string, string> {
    return {
      authorization: BEARER_TOKEN,
      'x-csrf-token': this.ct0,
      cookie: `auth_token=${this.authToken}; ct0=${this.ct0}`,
      'x-twitter-active-user': 'yes',
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-client-language': 'en',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      accept: '*/*',
    };
  }

  private async fetchGQL<T>(operation: string, variables: Record<string, unknown>): Promise<T> {
    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(DEFAULT_FEATURES),
    });
    const url = `${GQL_URL}/${operation}?${params.toString()}`;

    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`GraphQL ${operation} failed: HTTP ${res.status} - ${errText.slice(0, 200)}`);
    }

    return (await res.json()) as T;
  }

  async getUserProfile(screenName: string): Promise<XUser> {
    if (this.isMock) {
      const found = MOCK_SEED_USERS.find((u) => u.screenName.toLowerCase() === screenName.toLowerCase());
      return found || MOCK_SEED_USERS[0];
    }

    const cleanName = screenName.replace(/^@/, '');
    const data = await this.fetchGQL<Record<string, unknown>>(OP_USER_BY_SCREEN_NAME, {
      screen_name: cleanName,
    });

    return parseUserProfileResponse(data, cleanName);
  }

  async getFollowingList(seedUser: XUser, limit = 40): Promise<XUser[]> {
    if (this.isMock) {
      return MOCK_SEED_USERS;
    }

    const data = await this.fetchGQL<Record<string, unknown>>(OP_FOLLOWING, {
      userId: seedUser.id,
      count: limit,
      includePromotedContent: false,
    });

    return parseFollowingResponse(data);
  }

  async getUserTweets(screenName: string, count = 5): Promise<XTweet[]> {
    if (this.isMock) {
      return MOCK_TWEETS_WITH_COMMENTS.map((item) => item.tweet);
    }

    const userProfile = await this.getUserProfile(screenName);
    const data = await this.fetchGQL<Record<string, unknown>>(OP_USER_TWEETS, {
      userId: userProfile.id,
      count,
      includePromotedContent: false,
      withVoice: true,
    });

    return parseUserTweetsResponse(data, screenName, userProfile.name);
  }

  async getTweetComments(tweetId: string): Promise<XComment[]> {
    if (this.isMock) {
      const match = MOCK_TWEETS_WITH_COMMENTS.find((item) => item.tweet.id === tweetId);
      return match ? match.comments : [];
    }

    try {
      const data = await this.fetchGQL<Record<string, unknown>>(OP_TWEET_DETAIL, {
        focalTweetId: tweetId,
        with_rux_injections: false,
        includePromotedContent: false,
        withCommunity: true,
        withQuickPromoteEligibilityTweetFields: true,
        withBirdwatchNotes: true,
        withVoice: true,
        withV2Timeline: true,
      });

      return parseTweetCommentsResponse(data, tweetId);
    } catch (err) {
      console.warn(`[X Client] Failed to fetch comments for ${tweetId}:`, err);
      return [];
    }
  }
}
