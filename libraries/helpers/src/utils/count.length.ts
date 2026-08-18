// @ts-ignore
import twitter from 'twitter-text';

export const X_STANDARD_MAX_LENGTH = 280;
export const X_PREMIUM_MAX_LENGTH = 25000;
export const X_TRUNCATION_WARNING_LENGTH = 280;
export const X_ARTICLE_MAX_LENGTH = 100000;

const X_LONG_POST_SUBSCRIPTION_TYPES = new Set([
  'Basic',
  'Premium',
  'PremiumPlus',
]);

export const isXLongPostSubscription = (
  subscriptionType?: string | null
): boolean => {
  return (
    !!subscriptionType && X_LONG_POST_SUBSCRIPTION_TYPES.has(subscriptionType)
  );
};

export const textSlicer = (
  integrationType: string,
  end: number,
  text: string
): { start: number; end: number } => {
  if (integrationType !== 'x') {
    return {
      start: 0,
      end,
    };
  }

  const { validRangeEnd, valid } = twitter.parseTweet(text, {
    version: 3,
    maxWeightedTweetLength: end,
    scale: 100,
    defaultWeight: 200,
    emojiParsingEnabled: true,
    transformedURLLength: 23,
    ranges: [
      { start: 0, end: 4351, weight: 100 },
      { start: 8192, end: 8205, weight: 100 },
      { start: 8208, end: 8223, weight: 100 },
      { start: 8242, end: 8247, weight: 100 },
    ],
  });

  return {
    start: 0,
    end: valid ? end : validRangeEnd,
  };
};

export const weightedLength = (text: string): number => {
  return twitter.parseTweet(text).weightedLength;
};

export const isXPremium = (additionalSettings?: unknown): boolean => {
  if (Array.isArray(additionalSettings)) {
    return additionalSettings.some(
      (setting: { title?: string; value?: unknown }) =>
        (setting?.title === 'Premium' || setting?.title === 'Verified') &&
        !!setting?.value
    );
  }

  return !!additionalSettings;
};

export const xMaxLength = (
  additionalSettings?: unknown,
  postType?: string
): number => {
  if (postType === 'article') {
    return X_ARTICLE_MAX_LENGTH;
  }

  return isXPremium(additionalSettings)
    ? X_PREMIUM_MAX_LENGTH
    : X_STANDARD_MAX_LENGTH;
};
