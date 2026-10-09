import { describe, expect, it } from 'vitest';
import {
  extractTweetText,
  parseTweetCommentsResponse,
  parseUserTweetsResponse,
  unwrapTweetResult,
} from '../scripts/x-crawler/x-response-parsers';

describe('X Response Parsers - Longform & Visibility Results Support', () => {
  it('unwrapTweetResult unwraps TweetWithVisibilityResults correctly', () => {
    const rawDirect = {
      __typename: 'Tweet',
      legacy: { id_str: '101', full_text: 'Direct tweet' },
    };
    expect(unwrapTweetResult(rawDirect)).toEqual(rawDirect);

    const rawWrapped = {
      __typename: 'TweetWithVisibilityResults',
      tweet: {
        __typename: 'Tweet',
        legacy: { id_str: '102', full_text: 'Wrapped tweet' },
      },
    };
    expect(unwrapTweetResult(rawWrapped)).toEqual(rawWrapped.tweet);

    expect(unwrapTweetResult(null)).toBeUndefined();
    expect(unwrapTweetResult('invalid')).toBeUndefined();
  });

  it('extractTweetText prioritizes note_tweet over truncated legacy full_text', () => {
    const longText = 'This is a longform technical essay with 500 characters of deep systems architecture details.';
    const tweetNode = {
      legacy: { full_text: 'This is a truncated snippet... https://t.co/abc' },
      note_tweet: {
        note_tweet_results: {
          result: { text: longText },
        },
      },
    };

    expect(extractTweetText(tweetNode)).toBe(longText);

    const standardTweet = {
      legacy: { full_text: 'Short tweet 280 chars' },
    };
    expect(extractTweetText(standardTweet)).toBe('Short tweet 280 chars');
  });

  it('parseUserTweetsResponse handles note_tweet and TweetWithVisibilityResults', () => {
    const mockGqlData = {
      data: {
        user: {
          result: {
            timeline: {
              timeline: {
                instructions: [
                  {
                    type: 'TimelineAddEntries',
                    entries: [
                      {
                        content: {
                          itemContent: {
                            tweet_results: {
                              result: {
                                __typename: 'TweetWithVisibilityResults',
                                tweet: {
                                  __typename: 'Tweet',
                                  legacy: {
                                    id_str: '888001',
                                    full_text: 'Truncated snippet... https://t.co/xyz',
                                    created_at: 'Wed Sep 26 08:00:00 +0000 2026',
                                    reply_count: 12,
                                    retweet_count: 24,
                                    favorite_count: 150,
                                  },
                                  note_tweet: {
                                    note_tweet_results: {
                                      result: {
                                        text: 'Full unabridged technical essay on distributed consensus on Cloudflare D1.',
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    };

    const tweets = parseUserTweetsResponse(mockGqlData, 'karpathy', 'Andrej Karpathy');
    expect(tweets).toHaveLength(1);
    expect(tweets[0].id).toBe('888001');
    expect(tweets[0].text).toBe(
      'Full unabridged technical essay on distributed consensus on Cloudflare D1.'
    );
    expect(tweets[0].author).toBe('karpathy');
    expect(tweets[0].authorName).toBe('Andrej Karpathy');
    expect(tweets[0].likeCount).toBe(150);
  });

  it('parseTweetCommentsResponse extracts note_tweet text from thread comments', () => {
    const mockThreadData = {
      data: {
        threaded_conversation_with_injections_v2: {
          instructions: [
            {
              type: 'TimelineAddEntries',
              entries: [
                {
                  entryId: 'conversationthread-123',
                  content: {
                    items: [
                      {
                        item: {
                          itemContent: {
                            tweet_results: {
                              result: {
                                __typename: 'TweetWithVisibilityResults',
                                tweet: {
                                  legacy: {
                                    id_str: 'comment_99',
                                    full_text: 'Short reply...',
                                    favorite_count: 42,
                                    created_at: 'Wed Sep 26 08:30:00 +0000 2026',
                                  },
                                  note_tweet: {
                                    note_tweet_results: {
                                      result: {
                                        text: 'Counterpoint: The real bottleneck is write lock contention on edge SQLite.',
                                      },
                                    },
                                  },
                                  core: {
                                    user_results: {
                                      result: {
                                        core: { name: 'Swyx', screen_name: 'swyx' },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    };

    const comments = parseTweetCommentsResponse(mockThreadData, 'focal_tweet_id');
    expect(comments).toHaveLength(1);
    expect(comments[0].id).toBe('comment_99');
    expect(comments[0].author).toBe('swyx');
    expect(comments[0].text).toBe(
      'Counterpoint: The real bottleneck is write lock contention on edge SQLite.'
    );
    expect(comments[0].likeCount).toBe(42);
  });
});
