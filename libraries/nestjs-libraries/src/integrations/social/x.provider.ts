import { TweetV2, TwitterApi } from 'twitter-api-v2';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { parseFragment } from 'parse5';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  AnalyticsData,
  AuthTokenDetails,
  ChannelAnalyticsCaptureRequest,
  ChannelAnalyticsCapturePage,
  ChannelInteractionDirection,
  ChannelInteractionKind,
  ChannelInteractionKindCoverage,
  ChannelWebhookDeliveryRequest,
  ChannelWebhookDeliveryResult,
  ChannelInteractionSubscriptionReconciliationResult,
  ChannelInteractionTrackingFailureCategory,
  DesiredChannelInteractionSubscription,
  FollowerPage,
  FollowerQuery,
  FollowerSort,
  NormalizedChannelContentEvent,
  NormalizedChannelInteractionEvent,
  PendingCheckResponse,
  PostDetails,
  PostResponse,
  ProviderWebhookEndpointReconciliationResult,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import {
  API_ORDER_FOLLOWER_SORTS,
  FOLLOWER_DATABASE_INTERACTIONS_SORT,
} from '@gitroom/nestjs-libraries/integrations/social/follower.sorts';
import { lookup } from 'mime-types';
import sharp from 'sharp';
import { readOrFetch } from '@gitroom/helpers/utils/read.or.fetch';
import {
  BadBody,
  RefreshToken,
  SocialAbstract,
} from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { Plug } from '@gitroom/helpers/decorators/plug.decorator';
import { Integration } from '@prisma/client';
import { timer } from '@gitroom/helpers/utils/timer';
import { PostPlug } from '@gitroom/helpers/decorators/post.plug';
import { uniqBy } from 'lodash';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { stripLinks as removeLinks } from '@gitroom/helpers/utils/strip.links';
import { XDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/x.dto';
import { Rules } from '@gitroom/nestjs-libraries/chat/rules.description.decorator';
import { hasExtension } from '@gitroom/helpers/utils/has.extension';
import { xMaxLength } from '@gitroom/helpers/utils/count.length';

dayjs.extend(utc);

// Travels through the workflow history between postPending, checkPostStatus
// and finalizePost - keep it small JSON (media ids and the tweet content).
type XPendingData = {
  message: string;
  settings: {
    who_can_reply_post?:
    | 'everyone'
    | 'following'
    | 'mentionedUsers'
    | 'subscribers'
    | 'verified';
    community?: string;
    made_with_ai?: boolean;
    paid_partnership?: boolean;
    post_type?: 'post' | 'article';
    article_title?: string;
    article_status?: 'draft' | 'published';
  };
  mediaIds: string[];
  // Article cover selected in the settings, uploaded separately from the post
  // media (which is embedded in the article body).
  coverMediaId?: string;
  // Media still transcoding on X's side, waiting for STATUS = succeeded.
  processingIds: string[];
  // Arm -> confirm -> publish handshake (same as the Facebook story flow):
  // finalizePost arms without mutating, checkPostStatus witnesses, and only a
  // witnessed attempt runs the create - so a create that dies with an unknown
  // outcome is detected instead of run again (X has no idempotency key).
  attempting?: boolean;
  confirmed?: boolean;
};

type XWebhookUser = {
  id?: string | number;
  id_str?: string;
  name?: string;
  username?: string;
  screen_name?: string;
  profile_image_url?: string;
  profile_image_url_https?: string;
};

type XActivitySubscriptionSpec = DesiredChannelInteractionSubscription & {
  eventType:
  | 'like.create'
  | 'follow.follow'
  | 'follow.unfollow'
  | 'post.create'
  | 'post.delete'
  | 'post.mention.create'
  | 'post.repost.create';
  filterDirection?: ChannelInteractionDirection;
};

type XActivitySubscription = {
  subscription_id?: string;
  event_type?: string;
  filter?: {
    user_id?: string | number;
    direction?: string;
  };
  tag?: string;
  webhook_id?: string | number;
  webhook?: { id?: string | number; webhook_id?: string | number };
};

type XWebhookApiErrorCategory =
  | 'authentication_failed'
  | 'auth_mode_unsupported'
  | 'entitlement_required'
  | 'missing_scope'
  | 'quota_exceeded'
  | 'transient_failure'
  | 'invalid_request';

class XWebhookApiError extends Error {
  constructor(public readonly category: XWebhookApiErrorCategory) {
    super(category);
  }
}

const X_WEBHOOK_NORMALIZATION_VERSION = 2;
const X_WEBHOOK_MAX_BODY_BYTES = 1024 * 1024;
const X_WEBHOOK_MAX_CRC_TOKEN_LENGTH = 1024;
const X_WEBHOOK_API_BASE = 'https://api.x.com/2';
const X_ACTIVITY_SUBSCRIPTIONS: XActivitySubscriptionSpec[] = [
  {
    eventKey: 'like.create',
    eventType: 'like.create',
    direction: 'inbound',
    filterDirection: 'inbound',
  },
  {
    eventKey: 'like.create',
    eventType: 'like.create',
    direction: 'outbound',
    filterDirection: 'outbound',
  },
  {
    eventKey: 'follow.follow',
    eventType: 'follow.follow',
    direction: 'inbound',
  },
  {
    eventKey: 'follow.unfollow',
    eventType: 'follow.unfollow',
    direction: 'inbound',
  },
  {
    eventKey: 'post.create',
    eventType: 'post.create',
    direction: 'outbound',
  },
  {
    eventKey: 'post.delete',
    eventType: 'post.delete',
    direction: 'outbound',
  },
  {
    eventKey: 'post.mention.create',
    eventType: 'post.mention.create',
    direction: 'inbound',
  },
  {
    eventKey: 'post.repost.create',
    eventType: 'post.repost.create',
    direction: 'inbound',
    filterDirection: 'inbound',
  },
  {
    eventKey: 'post.repost.create',
    eventType: 'post.repost.create',
    direction: 'outbound',
    filterDirection: 'outbound',
  },
];

@Rules(
  `X can have maximum 4 pictures, or maximum one video, it can also be without attachments, it can also be published as a long-form article (draft or published) when post_type is set to article ${process.env.STRIP_LINKS_FROM_X_POSTS
    ? 'do not add links, they will be stripped from the post'
    : ''
  }`
)
export class XProvider extends SocialAbstract implements SocialProvider {
  identifier = 'x';
  name = 'X';
  isBetweenSteps = false;
  scopes = [] as string[];

  get analyticsSnapshot() {
    if (process.env.DISABLE_X_ANALYTICS) {
      return undefined;
    }

    return {
      capture: (request: ChannelAnalyticsCaptureRequest) =>
        this.captureAnalyticsSnapshot(request),
    };
  }
  stripLinks = () => !!process.env.STRIP_LINKS_FROM_X_POSTS;
  // X rate limits are per user (300 posts / 3 hours), not per app, so the cap
  // only needs to keep bursts polite. With the pending flow the slot is held
  // for actual API work only (processing waits live in workflow timers), so a
  // single slot is no longer required - it would serialize every customer's
  // status checks behind uploads.
  override maxConcurrentJob = 10;
  toolTip =
    'You will be logged in into your current account, if you would like a different account, change it first on X';

  // The provider receives the rich HTML so articles keep their formatting;
  // regular tweets are stripped to plain text inside the provider.
  editor = 'html' as const;
  dto = XDto;
  followerSorts: FollowerSort[] = [
    ...API_ORDER_FOLLOWER_SORTS,
    FOLLOWER_DATABASE_INTERACTIONS_SORT,
  ];
  channelInteractionWebhooks = {
    verifyChallenge: async (request: {
      query: Record<string, string | string[] | undefined>;
    }) => this.verifyInteractionWebhookChallenge(request.query),
    verifyAndNormalizeDelivery: async (
      request: ChannelWebhookDeliveryRequest
    ) => this.verifyAndNormalizeInteractionDelivery(request),
    getDesiredSubscriptions: (integration: Integration) =>
      this.getDesiredInteractionSubscriptions(integration),
    getInteractionCoverage: () => this.getInteractionCoverage(),
    reconcileEndpoint: () => this.reconcileInteractionWebhookEndpoint(),
    reconcileSubscriptions: (integration: Integration, accessToken: string) =>
      this.reconcileInteractionSubscriptions(integration, accessToken),
  };

  maxLength(additionalSettings?: any, settings?: any) {
    return xMaxLength(additionalSettings, settings?.post_type);
  }

  profileUrl(integration: Integration) {
    return integration.profile
      ? `https://x.com/${encodeURIComponent(integration.profile)}`
      : undefined;
  }

  private verifyInteractionWebhookChallenge(
    query: Record<string, string | string[] | undefined>
  ) {
    const token = query.crc_token;
    const secret = process.env.X_API_SECRET;
    if (
      !secret ||
      typeof token !== 'string' ||
      !token ||
      token.length > X_WEBHOOK_MAX_CRC_TOKEN_LENGTH
    ) {
      return Promise.resolve({ accepted: false as const, statusCode: 400 });
    }
    return Promise.resolve({
      accepted: true as const,
      responseBody: {
        response_token: `sha256=${createHmac('sha256', secret)
          .update(token)
          .digest('base64')}`,
      },
    });
  }

  private async verifyAndNormalizeInteractionDelivery(
    request: ChannelWebhookDeliveryRequest
  ): Promise<ChannelWebhookDeliveryResult> {
    const secret = process.env.X_API_SECRET;
    const rawBody = request?.rawBody;
    const signature = this.singleHeader(
      request?.headers,
      'x-twitter-webhooks-signature'
    );
    if (!Buffer.isBuffer(rawBody) || !rawBody.length) {
      return { accepted: false, statusCode: 400 };
    }
    if (rawBody.length > X_WEBHOOK_MAX_BODY_BYTES) {
      return { accepted: false, statusCode: 413 };
    }
    if (!secret || !this.isValidWebhookSignature(rawBody, signature, secret)) {
      return { accepted: false, statusCode: 401 };
    }

    let body: any;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return { accepted: false, statusCode: 400 };
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { accepted: false, statusCode: 400 };
    }
    const envelope = body.data;
    if (
      !envelope ||
      typeof envelope !== 'object' ||
      Array.isArray(envelope) ||
      typeof envelope.event_type !== 'string' ||
      !envelope.filter ||
      typeof envelope.filter !== 'object' ||
      Array.isArray(envelope.filter) ||
      !envelope.payload ||
      typeof envelope.payload !== 'object' ||
      Array.isArray(envelope.payload) ||
      (envelope.includes !== undefined &&
        (!envelope.includes ||
          typeof envelope.includes !== 'object' ||
          Array.isArray(envelope.includes)))
    ) {
      return { accepted: false, statusCode: 400 };
    }
    const connectedAccountId = this.boundedId(envelope.filter.user_id);
    if (!connectedAccountId) {
      return { accepted: false, statusCode: 400 };
    }

    try {
      const { events, contentEvents } = this.normalizeInteractionPayload(
        envelope,
        connectedAccountId,
        new Date().toISOString()
      );
      return { accepted: true, connectedAccountId, events, contentEvents };
    } catch {
      return { accepted: false, statusCode: 400 };
    }
  }

  private singleHeader(
    headers: Record<string, string | string[] | undefined> | undefined,
    name: string
  ) {
    if (!headers) return undefined;
    const value = Object.entries(headers).find(
      ([key]) => key.toLowerCase() === name
    )?.[1];
    return typeof value === 'string' ? value : undefined;
  }

  private isValidWebhookSignature(
    rawBody: Buffer,
    signature: string | undefined,
    secret: string
  ) {
    if (!signature?.startsWith('sha256=')) return false;
    const encoded = signature.slice('sha256='.length);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return false;
    const supplied = Buffer.from(encoded, 'base64');
    if (supplied.length !== 32 || supplied.toString('base64') !== encoded) {
      return false;
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest();
    return timingSafeEqual(expected, supplied);
  }

  private emptyNormalizedActivity(): {
    events: NormalizedChannelInteractionEvent[];
    contentEvents: NormalizedChannelContentEvent[];
  } {
    return { events: [], contentEvents: [] };
  }

  private normalizeInteractionPayload(
    envelope: any,
    connectedAccountId: string,
    receivedAt: string
  ): {
    events: NormalizedChannelInteractionEvent[];
    contentEvents: NormalizedChannelContentEvent[];
  } {
    const eventType = envelope.event_type;
    const eventUuid = this.boundedId(envelope.event_uuid);
    const payload = envelope.payload;
    const includes = envelope.includes || {};

    if (eventType === 'like.create') {
      const direction = envelope.filter.direction;
      if (direction !== 'inbound' && direction !== 'outbound') {
        throw new Error('Malformed X like direction');
      }
      const likedAuthorId = this.boundedId(payload.liked_tweet_author_id);
      const counterpartyId =
        direction === 'outbound'
          ? likedAuthorId
          : this.xIncludedUsers(includes).find(
            (candidate) => candidate.externalId !== connectedAccountId
          )?.externalId;
      const counterparty = this.xIncludedProfile(includes, counterpartyId);
      const relatedObjectId = this.boundedId(payload.liked_tweet_id);
      if (!counterparty || !relatedObjectId) return this.emptyNormalizedActivity();
      return {
        events: [
          this.xInteractionEvent({
            eventUuid,
            sourceType: eventType,
            sourceId: this.boundedId(payload.id),
            kind: 'like',
            direction,
            eventAt: this.xEventTimestamp(payload, receivedAt),
            counterparty,
            connectedAccountId,
            relatedObjectId,
          }),
        ],
        contentEvents: [],
      };
    }

    if (eventType === 'follow.follow' || eventType === 'follow.unfollow') {
      const source = this.xProfile(payload?.source?.data);
      const target = this.xProfile(payload?.target?.data);
      const direction =
        source?.externalId === connectedAccountId
          ? 'outbound'
          : target?.externalId === connectedAccountId
            ? 'inbound'
            : undefined;
      const counterparty = direction === 'outbound' ? target : source;
      if (!direction || !counterparty) return this.emptyNormalizedActivity();
      return {
        events: [
          this.xInteractionEvent({
            eventUuid,
            sourceType: eventType,
            kind: 'follow',
            direction,
            eventAt: this.xEventTimestamp(payload, receivedAt),
            counterparty,
            connectedAccountId,
            membershipUpdate:
              direction === 'inbound'
                ? eventType === 'follow.unfollow'
                  ? 'not_follower'
                  : 'follower'
                : undefined,
          }),
        ],
        contentEvents: [],
      };
    }

    if (eventType === 'post.delete') {
      return this.normalizePostDelete(payload, connectedAccountId, receivedAt);
    }

    if (
      eventType === 'post.create' ||
      eventType === 'post.mention.create' ||
      eventType === 'post.repost.create'
    ) {
      return this.normalizeTweetInteraction(
        payload,
        includes,
        connectedAccountId,
        eventType,
        eventUuid,
        receivedAt
      );
    }

    return this.emptyNormalizedActivity();
  }

  private normalizePostDelete(
    payload: any,
    connectedAccountId: string,
    receivedAt: string
  ): {
    events: NormalizedChannelInteractionEvent[];
    contentEvents: NormalizedChannelContentEvent[];
  } {
    const tweetId = this.boundedId(payload?.id_str ?? payload?.id);
    const authorId = this.boundedId(payload?.author_id);
    if (!tweetId) {
      throw new Error('Malformed X post delete activity');
    }
    if (authorId && authorId !== connectedAccountId) {
      return this.emptyNormalizedActivity();
    }
    return {
      events: [],
      contentEvents: [
        {
          type: 'post.delete',
          externalId: tweetId,
          deletedAt: this.xEventTimestamp(payload, receivedAt),
        },
      ],
    };
  }

  private normalizeTweetInteraction(
    tweet: any,
    includes: any,
    connectedAccountId: string,
    eventType: 'post.create' | 'post.mention.create' | 'post.repost.create',
    eventUuid: string | undefined,
    receivedAt: string
  ): {
    events: NormalizedChannelInteractionEvent[];
    contentEvents: NormalizedChannelContentEvent[];
  } {
    const actor = this.xIncludedProfile(includes, tweet?.author_id);
    const tweetId = this.boundedId(tweet?.id_str ?? tweet?.id);
    if (!actor || !tweetId) {
      throw new Error('Malformed X post activity');
    }
    const eventAt = this.xEventTimestamp(tweet, receivedAt);
    const events: NormalizedChannelInteractionEvent[] = [];
    const outbound =
      (eventType === 'post.create' || eventType === 'post.repost.create') &&
      actor.externalId === connectedAccountId;
    const references = Array.isArray(tweet?.referenced_tweets)
      ? tweet.referenced_tweets
      : [];
    const replyReference = references.find(
      (reference: any) => reference?.type === 'replied_to'
    );
    if (replyReference) {
      const parent = this.xIncludedTweet(includes, replyReference.id);
      const parentAuthorId = this.boundedId(parent?.author_id);
      const relevant = outbound || parentAuthorId === connectedAccountId;
      const counterparty = outbound
        ? this.xIncludedProfile(includes, parentAuthorId)
        : actor;
      if (
        relevant &&
        counterparty &&
        counterparty.externalId !== connectedAccountId
      ) {
        events.push(
          this.xInteractionEvent({
            eventUuid,
            sourceType: eventType,
            sourceId: tweetId,
            kind: 'reply',
            direction: outbound ? 'outbound' : 'inbound',
            eventAt,
            counterparty,
            connectedAccountId,
            relatedObjectId: this.boundedId(replyReference.id),
          })
        );
      }
    }

    const repostReference = references.find(
      (reference: any) => reference?.type === 'retweeted'
    );
    const referencedPost = this.xIncludedTweet(includes, repostReference?.id);
    const referencedAuthor = this.xIncludedProfile(
      includes,
      referencedPost?.author_id
    );
    const repostIsRelevant =
      repostReference &&
      referencedAuthor &&
      (outbound || referencedAuthor.externalId === connectedAccountId);
    if (repostIsRelevant) {
      const counterparty = outbound ? referencedAuthor : actor;
      if (counterparty.externalId !== connectedAccountId) {
        events.push(
          this.xInteractionEvent({
            eventUuid,
            sourceType: eventType,
            sourceId: tweetId,
            kind: 'repost',
            direction: outbound ? 'outbound' : 'inbound',
            eventAt,
            counterparty,
            connectedAccountId,
            relatedObjectId: this.boundedId(repostReference.id),
            metadata: { referenceType: 'repost' },
          })
        );
      }
    }

    if (!events.length) {
      const mentions = this.xMentionProfiles(tweet);
      if (
        !outbound &&
        mentions.some((m) => m.externalId === connectedAccountId)
      ) {
        events.push(
          this.xInteractionEvent({
            eventUuid,
            sourceType: eventType,
            sourceId: tweetId,
            kind: 'mention',
            direction: 'inbound',
            eventAt,
            counterparty: actor,
            connectedAccountId,
            relatedObjectId: tweetId,
          })
        );
      } else if (outbound) {
        for (const counterparty of mentions.filter(
          (mention) => mention.externalId !== connectedAccountId
        )) {
          events.push(
            this.xInteractionEvent({
              eventUuid,
              sourceType: eventType,
              sourceId: tweetId,
              kind: 'mention',
              direction: 'outbound',
              eventAt,
              counterparty,
              connectedAccountId,
              relatedObjectId: tweetId,
            })
          );
        }
      }
    }
    const contentEvents: NormalizedChannelContentEvent[] = [];
    if (this.isStandaloneOutboundPost(tweet, outbound)) {
      contentEvents.push({
        type: 'post.upsert',
        externalId: tweetId,
        url: this.xStatusUrl(actor.username, tweetId),
        content: this.xPostText(tweet),
        publishedAt: eventAt,
      });
    }
    return { events, contentEvents };
  }

  private isStandaloneOutboundPost(tweet: any, outbound: boolean) {
    if (!outbound) return false;
    const references = Array.isArray(tweet?.referenced_tweets)
      ? tweet.referenced_tweets
      : [];
    if (
      references.some((reference: any) =>
        ['replied_to', 'retweeted', 'quoted'].includes(reference?.type)
      )
    ) {
      return false;
    }
    return !(
      this.boundedId(tweet?.in_reply_to_tweet_id) ||
      this.boundedId(tweet?.in_reply_to_status_id)
    );
  }

  private xPostText(tweet: any) {
    return (
      this.boundedText(
        tweet?.extended_tweet?.full_text ?? tweet?.full_text ?? tweet?.text,
        100000
      ) || ''
    );
  }

  private xStatusUrl(username: string | undefined, tweetId: string) {
    return username
      ? `https://twitter.com/${encodeURIComponent(username)}/status/${tweetId}`
      : `https://x.com/i/status/${tweetId}`;
  }

  private xMentionProfiles(tweet: any) {
    const values = [
      ...(tweet?.entities?.mentions || []),
      ...(tweet?.entities?.user_mentions || []),
      ...(tweet?.extended_tweet?.entities?.user_mentions || []),
    ];
    const profiles = values
      .map((mention: any) =>
        this.xProfile({
          id_str: mention?.id_str ?? mention?.id,
          name: mention?.name,
          screen_name: mention?.screen_name ?? mention?.username,
        })
      )
      .filter(Boolean) as NonNullable<ReturnType<XProvider['xProfile']>>[];
    return uniqBy(profiles, (profile) => profile.externalId);
  }

  private xProfile(user: XWebhookUser | undefined) {
    const externalId = this.boundedId(user?.id_str ?? user?.id);
    if (!externalId) return undefined;
    const username = this.boundedText(
      user?.screen_name ?? user?.username,
      512
    );
    const picture = this.safeHttpUrl(
      user?.profile_image_url_https || user?.profile_image_url
    );
    return {
      externalId,
      ...(this.boundedText(user?.name, 512)
        ? { name: this.boundedText(user?.name, 512) }
        : {}),
      ...(username
        ? {
          username,
          profileUrl: `https://x.com/${encodeURIComponent(username)}`,
        }
        : {}),
      ...(picture ? { picture } : {}),
    };
  }

  private boundedId(value: unknown) {
    if (
      (typeof value !== 'string' && typeof value !== 'number') ||
      !String(value) ||
      String(value).length > 512
    ) {
      return undefined;
    }
    return String(value);
  }

  private boundedText(value: unknown, maxLength: number) {
    return typeof value === 'string' &&
      value.length > 0 &&
      value.length <= maxLength
      ? value
      : undefined;
  }

  private safeHttpUrl(value: unknown) {
    if (typeof value !== 'string' || value.length > 4096) return undefined;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:'
        ? value
        : undefined;
    } catch {
      return undefined;
    }
  }

  private xTimestamp(primary: unknown, fallback?: unknown) {
    const value =
      typeof primary === 'number' ||
        (typeof primary === 'string' && /^\d+$/.test(primary))
        ? new Date(Number(primary))
        : new Date(String(primary ?? fallback ?? ''));
    if (Number.isNaN(value.getTime())) {
      throw new Error('Malformed X activity timestamp');
    }
    return value.toISOString();
  }

  private xEventTimestamp(payload: any, receivedAt: string) {
    if (payload?.timestamp_ms !== undefined || payload?.created_at) {
      return this.xTimestamp(payload.timestamp_ms, payload.created_at);
    }
    return receivedAt;
  }

  private xIncludedUsers(includes: any) {
    if (includes?.users !== undefined && !Array.isArray(includes.users)) {
      throw new Error('Malformed X activity user expansions');
    }
    return (includes?.users || [])
      .map((user: any) => this.xProfile(user))
      .filter(Boolean) as NonNullable<ReturnType<XProvider['xProfile']>>[];
  }

  private xIncludedProfile(includes: any, id: unknown) {
    const externalId = this.boundedId(id);
    if (!externalId) return undefined;
    return (
      this.xIncludedUsers(includes).find(
        (profile) => profile.externalId === externalId
      ) || this.xProfile({ id_str: externalId })
    );
  }

  private xIncludedTweet(includes: any, id: unknown) {
    const tweetId = this.boundedId(id);
    if (!tweetId) return undefined;
    if (includes?.tweets !== undefined && !Array.isArray(includes.tweets)) {
      throw new Error('Malformed X activity post expansions');
    }
    return (includes?.tweets || []).find(
      (tweet: any) => this.boundedId(tweet?.id) === tweetId
    );
  }

  private xInteractionEvent(input: {
    eventUuid?: string;
    sourceType: string;
    sourceId?: string;
    kind: ChannelInteractionKind;
    direction: ChannelInteractionDirection;
    eventAt: string;
    counterparty: NonNullable<ReturnType<XProvider['xProfile']>>;
    connectedAccountId: string;
    relatedObjectId?: string;
    metadata?: Record<string, string>;
    membershipUpdate?: 'follower' | 'not_follower';
  }): NormalizedChannelInteractionEvent {
    const semanticIdentity = [
      input.kind,
      input.direction,
      input.connectedAccountId,
      input.counterparty.externalId,
      input.relatedObjectId || '',
    ].join('\n');
    const canonical = input.eventUuid
      ? [
        X_WEBHOOK_NORMALIZATION_VERSION,
        'event_uuid',
        input.eventUuid,
        semanticIdentity,
      ].join('\n')
      : [
        X_WEBHOOK_NORMALIZATION_VERSION,
        input.sourceType,
        input.sourceId || '',
        semanticIdentity,
        input.eventAt,
      ].join('\n');
    const providerEventKey = `x:v${X_WEBHOOK_NORMALIZATION_VERSION}:sha256:${createHash(
      'sha256'
    )
      .update(canonical)
      .digest('hex')}`;
    return {
      providerEventKey,
      kind: input.kind,
      direction: input.direction,
      eventAt: input.eventAt,
      counterparty: input.counterparty,
      eventType: input.sourceType,
      ...(input.relatedObjectId
        ? { relatedObjectId: input.relatedObjectId }
        : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
      normalizationVersion: X_WEBHOOK_NORMALIZATION_VERSION,
      ...(input.membershipUpdate
        ? { membershipUpdate: input.membershipUpdate }
        : {}),
    };
  }

  private getDesiredInteractionSubscriptions(
    _integration: Integration
  ): DesiredChannelInteractionSubscription[] {
    return X_ACTIVITY_SUBSCRIPTIONS.map(({ eventKey, direction }) => ({
      eventKey,
      direction,
    }));
  }

  private getInteractionCoverage(): ChannelInteractionKindCoverage[] {
    return [
      { kind: 'like', inbound: 'supported', outbound: 'supported' },
      { kind: 'follow', inbound: 'supported', outbound: 'supported' },
      { kind: 'reply', inbound: 'supported', outbound: 'supported' },
      { kind: 'mention', inbound: 'supported', outbound: 'supported' },
      { kind: 'repost', inbound: 'supported', outbound: 'supported' },
    ];
  }

  private xWebhookCallbackUrl() {
    const override = process.env.X_WEBHOOK_CALLBACK_URL;
    const base = process.env.CHANNEL_WEBHOOK_CALLBACK_BASE_URL;
    const value =
      override ||
      (base ? `${base.replace(/\/+$/, '')}/channel-webhooks/x` : '');
    if (!value || value.length > 200) return undefined;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.toString() : undefined;
    } catch {
      return undefined;
    }
  }

  private async reconcileInteractionWebhookEndpoint(): Promise<ProviderWebhookEndpointReconciliationResult> {
    const callbackUrl = this.xWebhookCallbackUrl();
    if (!callbackUrl || !process.env.X_WEBHOOK_BEARER_TOKEN) {
      return {
        state: 'unconfigured',
        failureCategory: 'configuration',
        reason: 'Tracking configuration is incomplete.',
      };
    }
    try {
      const webhooks = await this.xWebhookApi<{
        data?: { id?: string; url?: string; valid?: boolean }[];
      }>(`${X_WEBHOOK_API_BASE}/webhooks`, { method: 'GET' }, 'bearer');
      const existing = (webhooks.data || []).find(
        (webhook) => webhook.url === callbackUrl && this.boundedId(webhook.id)
      );
      if (existing?.id) {
        if (!existing.valid) {
          const validated = await this.xWebhookApi<{
            data?: { valid?: boolean };
          }>(
            `${X_WEBHOOK_API_BASE}/webhooks/${encodeURIComponent(existing.id)}`,
            { method: 'PUT' },
            'bearer'
          );
          if (!validated.data?.valid) {
            return {
              state: 'error',
              remoteWebhookId: existing.id,
              failureCategory: 'configuration',
              reason: 'The tracking callback could not be validated.',
            };
          }
        }
        return { state: 'active', remoteWebhookId: existing.id };
      }
      const created = await this.xWebhookApi<{
        data?: { id?: string; valid?: boolean };
      }>(
        `${X_WEBHOOK_API_BASE}/webhooks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: callbackUrl }),
        },
        'bearer'
      );
      const id = this.boundedId(created.data?.id);
      return id && created.data?.valid
        ? { state: 'active', remoteWebhookId: id }
        : {
          state: 'error',
          ...(id ? { remoteWebhookId: id } : {}),
          failureCategory: 'configuration',
          reason: 'The tracking callback could not be validated.',
        };
    } catch (error) {
      return {
        state: 'error',
        ...this.xWebhookFailure(error),
      };
    }
  }

  private async reconcileInteractionSubscriptions(
    integration: Integration,
    accessToken: string
  ): Promise<ChannelInteractionSubscriptionReconciliationResult> {
    const desired = this.getDesiredInteractionSubscriptions(integration);
    const coverage = this.getInteractionCoverage();
    const endpoint = await this.reconcileInteractionWebhookEndpoint();
    if (!endpoint.remoteWebhookId || endpoint.state !== 'active') {
      return {
        state: endpoint.state,
        subscriptions: desired.map((item) => ({
          ...item,
          state: endpoint.state,
          ...(endpoint.failureCategory
            ? {
              failureCategory: endpoint.failureCategory,
              reason: endpoint.reason,
            }
            : {}),
        })),
        coverage,
      };
    }
    try {
      const current = await this.xActivitySubscriptions(accessToken);
      const reconciled: ChannelInteractionSubscriptionReconciliationResult['subscriptions'] =
        [];

      for (const spec of X_ACTIVITY_SUBSCRIPTIONS) {
        try {
          const matching = current.filter((subscription) =>
            this.xActivitySubscriptionMatches(
              subscription,
              spec,
              integration.internalId
            )
          );

          if (integration.disabled || integration.deletedAt) {
            for (const subscription of matching) {
              await this.deleteXActivitySubscription(
                subscription.subscription_id,
                accessToken
              );
            }
            reconciled.push({
              eventKey: spec.eventKey,
              direction: spec.direction,
              state: 'unconfigured',
            });
            continue;
          }

          let active = matching[0];
          for (const duplicate of matching.slice(1)) {
            await this.deleteXActivitySubscription(
              duplicate.subscription_id,
              accessToken
            );
          }

          const tag = this.xActivitySubscriptionTag(integration, spec);
          let createdThisPass = false;
          if (!this.boundedId(active?.subscription_id)) {
            active = await this.createXActivitySubscription(
              spec,
              integration.internalId,
              endpoint.remoteWebhookId,
              tag
            );
            createdThisPass = true;
          }

          const remoteIdentifier = this.boundedId(active?.subscription_id);
          if (!remoteIdentifier) {
            throw new XWebhookApiError('invalid_request');
          }
          const attachedWebhookId = this.xSubscriptionWebhookId(active);
          // A PUT carrying a tag resets delivery back to "Stream only", so we
          // never PATCH delivery in place. Whenever the attached webhook is
          // missing or points at a different endpoint, delete and recreate the
          // subscription with our webhook attached from the start.
          if (!createdThisPass && attachedWebhookId !== endpoint.remoteWebhookId) {
            await this.deleteXActivitySubscription(remoteIdentifier);
            active = await this.createXActivitySubscription(
              spec,
              integration.internalId,
              endpoint.remoteWebhookId,
              tag
            );
          }
          const liveIdentifier =
            this.boundedId(active?.subscription_id) || remoteIdentifier;
          current.push({
            ...active,
            subscription_id: liveIdentifier,
            event_type: spec.eventType,
            filter: {
              user_id: integration.internalId,
              ...(spec.filterDirection
                ? { direction: spec.filterDirection }
                : {}),
            },
            webhook_id: endpoint.remoteWebhookId,
            tag,
          });
          reconciled.push({
            eventKey: spec.eventKey,
            direction: spec.direction,
            remoteIdentifier: liveIdentifier,
            state: 'active',
          });
        } catch (error) {
          reconciled.push({
            eventKey: spec.eventKey,
            direction: spec.direction,
            state: 'error',
            ...this.xWebhookFailure(error),
          });
        }
      }

      if (integration.disabled || integration.deletedAt) {
        return {
          state: 'unconfigured',
          subscriptions: reconciled,
          coverage,
        };
      }
      return {
        state: this.xReconciledSubscriptionState(reconciled),
        subscriptions: reconciled,
        coverage,
      };
    } catch (error) {
      const failure = this.xWebhookFailure(error);
      return {
        state: 'error',
        subscriptions: desired.map((item) => ({
          ...item,
          state: 'error',
          ...failure,
        })),
        coverage,
      };
    }
  }

  private xReconciledSubscriptionState(
    subscriptions: ChannelInteractionSubscriptionReconciliationResult['subscriptions']
  ): ChannelInteractionSubscriptionReconciliationResult['state'] {
    if (subscriptions.every((subscription) => subscription.state === 'active')) {
      return 'active';
    }
    if (subscriptions.some((subscription) => subscription.state === 'active')) {
      return 'partial';
    }
    return 'error';
  }

  private async xActivitySubscriptions(accessToken: string) {
    const subscriptions: XActivitySubscription[] = [];
    let paginationToken: string | undefined;
    do {
      const url = new URL(`${X_WEBHOOK_API_BASE}/activity/subscriptions`);
      url.searchParams.set('max_results', '1000');
      if (paginationToken) {
        url.searchParams.set('pagination_token', paginationToken);
      }
      const response = await this.xWebhookApi<{
        data?: XActivitySubscription[];
        meta?: { next_token?: string };
      }>(url.toString(), { method: 'GET' }, 'bearer');
      if (response.data !== undefined && !Array.isArray(response.data)) {
        throw new XWebhookApiError('invalid_request');
      }
      subscriptions.push(...(response.data || []));
      paginationToken = this.boundedId(response.meta?.next_token);
    } while (paginationToken);
    return subscriptions;
  }

  private xActivitySubscriptionMatches(
    subscription: XActivitySubscription,
    spec: XActivitySubscriptionSpec,
    userId: string
  ) {
    return (
      subscription.event_type === spec.eventType &&
      this.boundedId(subscription.filter?.user_id) === userId &&
      (subscription.filter?.direction || undefined) === spec.filterDirection &&
      !!this.boundedId(subscription.subscription_id)
    );
  }

  private xSubscriptionWebhookId(subscription: XActivitySubscription | undefined) {
    return (
      this.boundedId(subscription?.webhook_id) ||
      this.boundedId(subscription?.webhook?.id) ||
      this.boundedId(subscription?.webhook?.webhook_id)
    );
  }

  private async createXActivitySubscription(
    spec: XActivitySubscriptionSpec,
    userId: string,
    webhookId: string,
    tag: string
  ) {
    const created = await this.xWebhookApi<{
      data?:
      | XActivitySubscription
      | XActivitySubscription[]
      | { subscription?: XActivitySubscription };
    }>(
      `${X_WEBHOOK_API_BASE}/activity/subscriptions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: spec.eventType,
          filter: {
            user_id: userId,
            ...(spec.filterDirection ? { direction: spec.filterDirection } : {}),
          },
          webhook_id: webhookId,
          tag,
        }),
      },
      'bearer'
    );
    return this.xActivitySubscriptionFromResponse(created);
  }

  private xActivitySubscriptionTag(
    integration: Integration,
    spec: XActivitySubscriptionSpec
  ) {
    return `postiz:${integration.internalId}:${spec.eventKey}:${spec.direction}`;
  }

  private xActivitySubscriptionFromResponse(response: {
    data?:
    | XActivitySubscription
    | XActivitySubscription[]
    | { subscription?: XActivitySubscription };
  }) {
    const data = response.data;
    if (Array.isArray(data)) return data[0];
    if (data && 'subscription' in data) return data.subscription;
    return data as XActivitySubscription | undefined;
  }

  private async deleteXActivitySubscription(
    subscriptionId: string | undefined,
    _accessToken?: string
  ) {
    const id = this.boundedId(subscriptionId);
    if (!id) throw new XWebhookApiError('invalid_request');
    await this.xWebhookApi(
      `${X_WEBHOOK_API_BASE}/activity/subscriptions/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      'bearer'
    );
  }

  private async xWebhookApi<T = any>(
    url: string,
    options: RequestInit,
    authentication: 'bearer' | 'oauth1',
    accessToken?: string
  ): Promise<T> {
    const method = options.method || 'GET';
    let authorization: string;
    if (authentication === 'bearer') {
      authorization = `Bearer ${process.env.X_WEBHOOK_BEARER_TOKEN || ''}`;
    } else {
      const [token, secret] = (accessToken || '').split(':');
      if (!token || !secret) {
        throw new XWebhookApiError('authentication_failed');
      }
      authorization = this.signOAuth1(method, url, token, secret);
    }
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: authorization,
      },
    });
    if (response.ok) {
      if (response.status === 204) return {} as T;
      return this.parseXWebhookJson<T>(response);
    }
    let problem = '';
    try {
      problem = (await response.text()).slice(0, 4096).toLowerCase();
    } catch {
      // The status code is sufficient for classification.
    }
    throw new XWebhookApiError(
      this.classifyXWebhookApiError(response.status, problem)
    );
  }

  private async parseXWebhookJson<T>(response: Response): Promise<T> {
    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(
      text.replace(/(:\s*)(\d{16,})(\s*[,}\]])/g, '$1"$2"$3')
    ) as T;
  }

  private classifyXWebhookApiError(
    status: number,
    problem: string
  ): XWebhookApiErrorCategory {
    if (status === 429) return 'quota_exceeded';
    if (status >= 500) return 'transient_failure';
    if (
      problem.includes('scope') ||
      problem.includes('like.read') ||
      problem.includes('tweet.read')
    ) {
      return 'missing_scope';
    }
    if (
      problem.includes('unsupported authentication') ||
      problem.includes('auth mode') ||
      problem.includes('oauth')
    ) {
      return 'auth_mode_unsupported';
    }
    if (status === 401) return 'authentication_failed';
    if (
      status === 402 ||
      status === 403 ||
      problem.includes('entitlement') ||
      problem.includes('client-not-enrolled') ||
      problem.includes('subscription limit')
    ) {
      return 'entitlement_required';
    }
    return 'invalid_request';
  }

  private xWebhookFailure(error: unknown): {
    failureCategory: ChannelInteractionTrackingFailureCategory;
    reason: string;
  } {
    const category = error instanceof XWebhookApiError
      ? error.category
      : 'transient_failure';
    return {
      failureCategory: {
        authentication_failed: 'authentication',
        auth_mode_unsupported: 'authorization',
        entitlement_required: 'entitlement',
        missing_scope: 'authorization',
        quota_exceeded: 'quota',
        transient_failure: 'transient',
        invalid_request: 'unknown',
      }[category] as ChannelInteractionTrackingFailureCategory,
      reason: {
        authentication_failed: 'Tracking authentication needs attention.',
        auth_mode_unsupported: 'This channel authorization mode cannot create tracking subscriptions.',
        entitlement_required: 'This provider plan does not include this tracking feature.',
        missing_scope: 'Tracking permissions do not allow this subscription.',
        quota_exceeded: 'The provider tracking quota has been reached.',
        transient_failure: 'The provider is temporarily unavailable.',
        invalid_request: 'Tracking setup could not be completed.',
      }[category],
    };
  }

  async followers(
    integration: Integration,
    accessToken: string,
    query: FollowerQuery
  ): Promise<FollowerPage> {
    const client = await this.getClient(accessToken);
    const response = await client.v2.followers(integration.internalId, {
      max_results: query.limit,
      ...(query.cursor ? { pagination_token: query.cursor } : {}),
      'user.fields': [
        'created_at',
        'description',
        'profile_image_url',
        'public_metrics',
        'url',
        'username',
        'verified',
      ],
    });

    const isHttpUrl = (value?: string) => {
      try {
        return value && /^https?:$/.test(new URL(value).protocol)
          ? value
          : undefined;
      } catch {
        return undefined;
      }
    };
    const nextCursor = response.meta.next_token;

    return {
      items: (response.data || []).map((user) => ({
        id: user.id,
        name: user.name,
        username: user.username,
        ...(isHttpUrl(user.profile_image_url)
          ? { picture: user.profile_image_url }
          : {}),
        profileUrl: `https://x.com/${encodeURIComponent(user.username)}`,
        ...(user.description ? { bio: user.description } : {}),
        ...(user.public_metrics?.followers_count !== undefined
          ? { followersCount: user.public_metrics.followers_count }
          : {}),
        ...(user.public_metrics?.following_count !== undefined
          ? { followingCount: user.public_metrics.following_count }
          : {}),
        ...(user.created_at ? { accountCreatedAt: user.created_at } : {}),
      })),
      ...(nextCursor ? { nextCursor } : {}),
      hasMore: !!nextCursor,
    };
  }

  // With `editor = 'html'` the activity hands the provider HTML (needed for
  // articles); everything that becomes a tweet has to be flattened back to the
  // plain text X expects - same output the old 'normal' editor produced.
  private toTweetText(message: string) {
    return stripHtmlValidation(
      'normal',
      message,
      true,
      false,
      !/<\/?[a-z][\s\S]*>/i.test(message)
    );
  }

  override async checkValidity(
    [firstPost, ...comments]: Array<{ path: string }[]>,
    settings: any
  ): Promise<string | true> {
    if (settings?.post_type !== 'article') {
      return true;
    }

    if (
      [...(firstPost || []), ...comments.flat()].some((m) =>
        hasExtension(m.path, 'mp4')
      )
    ) {
      return 'X articles only support images';
    }

    // Replies can only be attached to the seed post a published article
    // creates - a draft has no post to reply to.
    if (settings?.article_status !== 'published' && comments.length) {
      return 'A draft article cannot have thread replies, remove them or publish the article';
    }

    return true;
  }

  override handleErrors(body: string):
    | {
      type: 'refresh-token' | 'bad-body' | 'retry';
      value: string;
    }
    | undefined {
    if (body.includes('You are not permitted to perform this action')) {
      return {
        type: 'bad-body',
        value:
          'There is a problem posting, please edit your post and check character count and media attachments',
      };
    }
    if (body.includes('Service Unavailable')) {
      return {
        type: 'retry',
        value: 'X is currently unavailable, please try again later',
      };
    }
    if (body.includes('maximum of one cashtag')) {
      return {
        type: 'bad-body',
        value: 'There can be maximum of one cashtag ($SYMBOL) per post',
      };
    }
    if (body.includes('maximum of 4 items')) {
      return {
        type: 'bad-body',
        value: 'There must be a maximum of 4 items per post',
      };
    }
    if (body.includes('Unsupported Authentication')) {
      return {
        type: 'refresh-token',
        value: 'X authentication has expired, please reconnect your account',
      };
    }

    if (body.includes('You are not allowed to create a Tweet')) {
      return {
        type: 'bad-body',
        value: 'You are not allowed to create a post with duplicate content',
      }
    }

    if (body.includes('usage-capped')) {
      return {
        type: 'bad-body',
        value: 'Posting failed - capped reached. Please try again later',
      };
    }

    if (body.includes('user-suspended')) {
      return {
        type: 'bad-body',
        value:
          'Your X account has been suspended, please reconnect with another account',
      };
    }
    if (body.includes('duplicate-rules')) {
      return {
        type: 'bad-body',
        value:
          'You have already posted this post, please wait before posting again',
      };
    }
    if (body.includes('Your account is not permitted to access this feature')) {
      return {
        type: 'bad-body',
        value:
          'X blocked your request',
      };
    }
    if (body.includes('The Tweet contains an invalid URL.')) {
      return {
        type: 'bad-body',
        value: 'The Tweet contains a URL that is not allowed on X',
      };
    }
    if (
      body.includes(
        'This user is not allowed to post a video longer than 2 minutes'
      )
    ) {
      return {
        type: 'bad-body',
        value:
          'The video you are trying to post is longer than 2 minutes, which is not allowed for this account',
      };
    }
    return undefined;
  }

  @Plug({
    identifier: 'x-autoRepostPost',
    title: 'Auto Repost Posts',
    disabled: !!process.env.DISABLE_X_ANALYTICS,
    description:
      'When a post reached a certain number of likes, repost it to increase engagement (1 week old posts)',
    runEveryMilliseconds: 21600000,
    totalRuns: 3,
    fields: [
      {
        name: 'likesAmount',
        type: 'number',
        placeholder: 'Amount of likes',
        description: 'The amount of likes to trigger the repost',
        validation: /^\d+$/,
      },
    ],
  })
  async autoRepostPost(
    integration: Integration,
    id: string,
    fields: { likesAmount: string }
  ) {
    // @ts-ignore
    // eslint-disable-next-line prefer-rest-params
    const [accessTokenSplit, accessSecretSplit] = integration.token.split(':');
    const client = new TwitterApi({
      appKey: process.env.X_API_KEY!,
      appSecret: process.env.X_API_SECRET!,
      accessToken: accessTokenSplit,
      accessSecret: accessSecretSplit,
    });

    if (
      (await client.v2.tweetLikedBy(id)).meta.result_count >=
      +fields.likesAmount
    ) {
      await timer(2000);
      await client.v2.retweet(integration.internalId, id);
      return true;
    }

    return false;
  }

  @PostPlug({
    identifier: 'x-repost-post-users',
    title: 'Add Re-posters',
    description: 'Add accounts to repost your post',
    pickIntegration: ['x'],
    fields: [],
  })
  async repostPostUsers(
    integration: Integration,
    originalIntegration: Integration,
    postId: string,
    information: any
  ) {
    const [accessTokenSplit, accessSecretSplit] = integration.token.split(':');
    const client = new TwitterApi({
      appKey: process.env.X_API_KEY!,
      appSecret: process.env.X_API_SECRET!,
      accessToken: accessTokenSplit,
      accessSecret: accessSecretSplit,
    });

    const {
      data: { id },
    } = await client.v2.me();

    try {
      await client.v2.retweet(id, postId);
    } catch (err) {
      /** nothing **/
    }
  }

  @Plug({
    identifier: 'x-autoPlugPost',
    title: 'Auto plug post',
    disabled: !!process.env.DISABLE_X_ANALYTICS,
    description:
      'When a post reached a certain number of likes, add another post to it so you followers get a notification about your promotion',
    runEveryMilliseconds: 21600000,
    totalRuns: 3,
    fields: [
      {
        name: 'likesAmount',
        type: 'number',
        placeholder: 'Amount of likes',
        description: 'The amount of likes to trigger the repost',
        validation: /^\d+$/,
      },
      {
        name: 'post',
        type: 'richtext',
        placeholder: 'Post to plug',
        description: 'Message content to plug',
        validation: /^[\s\S]{3,}$/g,
      },
    ],
  })
  async autoPlugPost(
    integration: Integration,
    id: string,
    fields: { likesAmount: string; post: string }
  ) {
    // @ts-ignore
    // eslint-disable-next-line prefer-rest-params
    const [accessTokenSplit, accessSecretSplit] = integration.token.split(':');
    const client = new TwitterApi({
      appKey: process.env.X_API_KEY!,
      appSecret: process.env.X_API_SECRET!,
      accessToken: accessTokenSplit,
      accessSecret: accessSecretSplit,
    });

    if (
      (await client.v2.tweetLikedBy(id)).meta.result_count >=
      +fields.likesAmount
    ) {
      await timer(2000);

      const plugText = stripHtmlValidation('normal', fields.post, true);
      await client.v2.tweet({
        text: this.stripLinks() ? removeLinks(plugText) : plugText,
        reply: { in_reply_to_tweet_id: id },
      });
      return true;
    }

    return false;
  }

  async refreshToken(): Promise<AuthTokenDetails> {
    return {
      id: '',
      name: '',
      accessToken: '',
      refreshToken: '',
      expiresIn: 0,
      picture: '',
      username: '',
    };
  }

  async generateAuthUrl() {
    const client = new TwitterApi({
      appKey: process.env.X_API_KEY!,
      appSecret: process.env.X_API_SECRET!,
    });
    const { url, oauth_token, oauth_token_secret } =
      await client.generateAuthLink(
        (process.env.X_URL || process.env.FRONTEND_URL) +
        `/integrations/social/x`,
        {
          authAccessType: 'write',
          linkMode: 'authenticate',
          forceLogin: false,
        }
      );
    return {
      url,
      codeVerifier: oauth_token + ':' + oauth_token_secret,
      state: oauth_token,
    };
  }

  async authenticate(params: { code: string; codeVerifier: string }) {
    const { code, codeVerifier } = params;
    const [oauth_token, oauth_token_secret] = codeVerifier.split(':');

    const startingClient = new TwitterApi({
      appKey: process.env.X_API_KEY!,
      appSecret: process.env.X_API_SECRET!,
      accessToken: oauth_token,
      accessSecret: oauth_token_secret,
    });

    const { accessToken, client, accessSecret } = await startingClient.login(
      code
    );

    const {
      data: { username, profile_image_url, name, id },
    } = await client.v2.me({
      'user.fields': [
        'username',
        'verified',
        'verified_type',
        'profile_image_url',
        'name',
      ],
    });

    return {
      id: String(id),
      accessToken: accessToken + ':' + accessSecret,
      name,
      refreshToken: '',
      expiresIn: 999999999,
      picture: profile_image_url || '',
      username,
      additionalSettings: [
        {
          title: 'Premium',
          description:
            'Enable if this account has X Premium (up to 25,000 characters). Posts over 280 characters are truncated for non-Premium viewers.',
          type: 'checkbox' as const,
          value: false,
        },
      ],
    };
  }

  private async getClient(accessToken: string) {
    const [accessTokenSplit, accessSecretSplit] = accessToken.split(':');
    return new TwitterApi({
      appKey: process.env.X_API_KEY!,
      appSecret: process.env.X_API_SECRET!,
      accessToken: accessTokenSplit,
      accessSecret: accessSecretSplit,
    });
  }

  private signOAuth1(
    method: string,
    url: string,
    accessToken: string,
    accessSecret: string
  ): string {
    const pct = (s: string) =>
      encodeURIComponent(s)
        .replace(/!/g, '%21')
        .replace(/\*/g, '%2A')
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29');

    const params: Record<string, string> = {
      oauth_consumer_key: process.env.X_API_KEY!,
      oauth_nonce: randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: String(Math.floor(Date.now() / 1000)),
      oauth_token: accessToken,
      oauth_version: '1.0',
    };

    const parsedUrl = new URL(url);
    const paramString = [
      ...Object.entries(params),
      ...Array.from(parsedUrl.searchParams.entries()),
    ]
      .map(([key, value]) => [pct(key), pct(value)] as const)
      .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey === rightKey
          ? leftValue.localeCompare(rightValue)
          : leftKey.localeCompare(rightKey)
      )
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    const baseString = [
      method.toUpperCase(),
      pct(`${parsedUrl.origin}${parsedUrl.pathname}`),
      pct(paramString),
    ].join('&');

    const signingKey = `${pct(process.env.X_API_SECRET!)}&${pct(accessSecret)}`;
    params.oauth_signature = createHmac('sha1', signingKey)
      .update(baseString)
      .digest('base64');

    return (
      'OAuth ' +
      Object.keys(params)
        .sort()
        .map((k) => `${pct(k)}="${pct(params[k])}"`)
        .join(', ')
    );
  }

  // X's v2 chunked upload requires a Buffer per APPEND segment, so we read one
  // ranged chunk at a time (mediaChunk) instead of buffering the whole video.
  // 1MB is the exact chunk size client.v2.uploadMedia used in production, so
  // it is proven against X's APPEND limits; larger chunks are documented but
  // unproven here.
  private static readonly X_UPLOAD_CHUNK_SIZE = 1024 * 1024;

  private async uploadVideoInChunks(client: TwitterApi, path: string) {
    const totalBytes = await this.mediaSize(path, this.identifier);
    const mediaType = String(lookup(path) || 'video/mp4');

    const init = await client.v2.post<{ data: { id: string } }>(
      'media/upload/initialize',
      {
        media_type: mediaType,
        total_bytes: totalBytes,
        media_category: 'tweet_video',
      }
    );
    const mediaId = init.data.id;

    const chunkSize = XProvider.X_UPLOAD_CHUNK_SIZE;
    const totalChunkCount = Math.ceil(totalBytes / chunkSize);
    for (let i = 0; i < totalChunkCount; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalBytes) - 1;
      await client.v2.post(
        `media/upload/${mediaId}/append`,
        {
          segment_index: i,
          media: await this.mediaChunk(path, start, end, this.identifier),
        },
        { forceBodyMode: 'form-data' }
      );
    }

    const finalize = await client.v2.post<{
      data: {
        id: string;
        processing_info?: { state: string; check_after_secs?: number };
      };
    }>(`media/upload/${mediaId}/finalize`);

    const processing = finalize.data.processing_info;

    // An explicit rejection right at finalize: the video will never process.
    if (processing?.state === 'failed') {
      throw new BadBody(
        this.identifier,
        JSON.stringify(processing),
        Buffer.from('{}'),
        `X failed to process the uploaded video${(processing as any)?.error?.message
          ? `: ${(processing as any).error.message}`
          : ''
        }`
      );
    }

    // Per the docs a missing processing_info means the media is ready to use;
    // anything else keeps transcoding asynchronously and must reach
    // `succeeded` before the media_id can be attached to a post.
    return {
      mediaId,
      processing: !!processing && processing.state !== 'succeeded',
    };
  }

  // Single STATUS read for a media_id, no loops and no timers - the polling
  // loop lives in the post workflow (checkPostStatus) or, for the legacy
  // paths, in waitForMediaProcessing.
  private async mediaProcessingStatus(client: TwitterApi, mediaId: string) {
    const status = await client.v2.get<{
      data: {
        processing_info?: {
          state: string;
          check_after_secs?: number;
          error?: { message?: string };
        };
      };
    }>('media/upload', { command: 'STATUS', media_id: mediaId });

    return status.data.processing_info;
  }

  // Blocking processing wait, used by the paths that still resolve everything
  // inside one activity (comments, and post() for pre-v1.0.6 workflows).
  private async waitForMediaProcessing(client: TwitterApi, mediaId: string) {
    // X drives the pace via check_after_secs; cap on accumulated wait time
    // (long videos can legitimately process for many minutes) instead of an
    // attempt count, but never poll forever.
    let waitedMs = 0;
    const maxWaitMs = 7 * 60 * 1000;
    let processing = await this.mediaProcessingStatus(client, mediaId);

    while (processing && processing.state !== 'succeeded') {
      if (processing.state === 'failed' || waitedMs >= maxWaitMs) {
        throw new BadBody(
          this.identifier,
          JSON.stringify(processing),
          Buffer.from('{}'),
          `X failed to process the uploaded video${processing?.error?.message ? `: ${processing.error.message}` : ''
          }`
        );
      }

      const waitMs = (processing.check_after_secs || 1) * 1000;
      await timer(waitMs);
      waitedMs += waitMs;
      processing = await this.mediaProcessingStatus(client, mediaId);
    }
  }

  // With ten X activities running concurrently (maxConcurrentJob), a user
  // publishing several posts at the same minute can 429 on the upload
  // endpoints; twitter-api-v2 errors never pass through this.fetch's backoff,
  // so retry them here instead of hard-failing the post. Nothing is published
  // at upload time, so a retried upload can never duplicate a post.
  private async uploadWithRateLimitRetry<T>(
    func: () => Promise<T>,
    totalRetries = 0
  ): Promise<T> {
    try {
      return await func();
    } catch (err: any) {
      if (totalRetries <= 2 && (err?.code === 429 || err?.rateLimitError)) {
        await timer(5000 * (totalRetries + 1));
        return this.uploadWithRateLimitRetry(func, totalRetries + 1);
      }

      throw err;
    }
  }

  private async uploadMediaEntries(
    client: TwitterApi,
    postDetails: PostDetails<any>[],
    asArticleImage = false
  ) {
    // Media is uploaded sequentially on purpose: uploading everything with
    // Promise.all holds every file in memory at the same time.
    const media = {} as Record<string, string[]>;
    const processingIds: string[] = [];
    for (const p of postDetails) {
      for (const m of p?.media || []) {
        const uploaded = await this.runInConcurrent(
          async () =>
            hasExtension(m.path, 'mp4')
              ? this.uploadWithRateLimitRetry(() =>
                this.uploadVideoInChunks(client, m.path)
              )
              : {
                // Articles reject GIF media, so the tweet pipeline (which
                // converts every image to GIF) can't be reused for them -
                // article images are uploaded as JPEG with the tweet_image
                // category the article references them by.
                mediaId: await this.uploadWithRateLimitRetry(async () =>
                  asArticleImage
                    ? client.v2.uploadMedia(
                      await sharp(await readOrFetch(m.path))
                        .resize({
                          width: 1000,
                        })
                        .jpeg()
                        .toBuffer(),
                      {
                        media_type: 'image/jpeg' as any,
                        media_category: 'tweet_image' as any,
                      }
                    )
                    : client.v2.uploadMedia(
                      await sharp(await readOrFetch(m.path), {
                        animated: lookup(m.path) === 'image/gif',
                      })
                        .resize({
                          width: 1000,
                        })
                        .gif()
                        .toBuffer(),
                      {
                        media_type: (lookup(m.path) || '') as any,
                      }
                    )
                ),
                processing: false,
              },
          true
        );

        if (!uploaded?.mediaId) {
          continue;
        }

        media[p.id] = media[p.id] || [];
        media[p.id].push(uploaded.mediaId);

        if (uploaded.processing) {
          processingIds.push(uploaded.mediaId);
        }
      }
    }

    return { media, processingIds };
  }

  // Legacy blocking upload (comments, and pre-v1.0.6 workflows through
  // post()): waits for the processing inside the activity like before.
  private async uploadMedia(
    client: TwitterApi,
    postDetails: PostDetails<any>[]
  ) {
    const { media, processingIds } = await this.uploadMediaEntries(
      client,
      postDetails
    );

    for (const mediaId of processingIds) {
      await this.waitForMediaProcessing(client, mediaId);
    }

    return media;
  }

  async postPending(
    id: string,
    accessToken: string,
    postDetails: PostDetails<{
      active_thread_finisher: boolean;
      thread_finisher: string;
      community?: string;
      who_can_reply_post:
      | 'everyone'
      | 'following'
      | 'mentionedUsers'
      | 'subscribers'
      | 'verified';
      made_with_ai?: boolean;
      paid_partnership?: boolean;
      post_type?: 'post' | 'article';
      article_title?: string;
      article_status?: 'draft' | 'published';
      article_cover?: { id: string; path: string };
    }>[],
    integration: Integration
  ): Promise<PostResponse[]> {
    const client = await this.getClient(accessToken);
    const [firstPost] = postDetails;
    const isArticle = firstPost?.settings?.post_type === 'article';

    // Upload the media now; the transcoding wait moves to checkPostStatus and
    // the tweet itself is only created by finalizePost, so nothing here is
    // irreversible - a failure leaves only orphaned media.
    const { media, processingIds } = await this.uploadMediaEntries(
      client,
      [firstPost],
      isArticle
    );

    // The article cover is picked in the settings, separate from the post
    // media (which is embedded in the article body).
    const coverPath = isArticle
      ? firstPost?.settings?.article_cover?.path
      : undefined;
    const coverMediaId = coverPath
      ? (
        await this.uploadMediaEntries(
          client,
          [{ id: 'article-cover', media: [{ path: coverPath }] } as any],
          true
        )
      ).media['article-cover']?.[0]
      : undefined;

    return [
      {
        id: firstPost.id,
        releaseURL: '',
        postId: '',
        status: 'pending',
        pendingData: {
          // Articles keep the HTML (converted to Draft.js in finalizePost),
          // tweets are flattened to plain text.
          message: isArticle
            ? firstPost.message
            : this.toTweetText(firstPost.message),
          settings: {
            who_can_reply_post: firstPost?.settings?.who_can_reply_post,
            community: firstPost?.settings?.community,
            made_with_ai: firstPost?.settings?.made_with_ai,
            paid_partnership: firstPost?.settings?.paid_partnership,
            post_type: firstPost?.settings?.post_type,
            article_title: firstPost?.settings?.article_title,
            article_status: firstPost?.settings?.article_status,
          },
          mediaIds: (media[firstPost.id] || []).filter((f) => f),
          ...(coverMediaId ? { coverMediaId } : {}),
          processingIds,
        } as XPendingData,
      },
    ];
  }

  override async checkPostStatus(
    accessToken: string,
    pendingData: XPendingData,
    integration: Integration
  ): Promise<PendingCheckResponse> {
    // A confirmed create attempt died without reporting its result: X gives
    // no cheap way to ask whether that tweet was created, so never run the
    // create again - stop with an explicit warning instead.
    if (pendingData.attempting && pendingData.confirmed) {
      throw new BadBody(
        this.identifier,
        '{}',
        Buffer.from('{}'),
        'X may have already published this post, please check your account before posting again to avoid duplicates'
      );
    }

    const client = await this.getClient(accessToken);

    // Check every media still transcoding; keep the ones not succeeded yet.
    const stillProcessing: string[] = [];
    for (const mediaId of pendingData.processingIds || []) {
      let processing:
        | { state: string; check_after_secs?: number; error?: { message?: string } }
        | undefined;
      try {
        processing = await this.mediaProcessingStatus(client, mediaId);
      } catch (err: any) {
        // twitter-api-v2 throws ApiResponseError, which never passes through
        // this.fetch/handleErrors: classify it here so revoked tokens and
        // suspended accounts fail properly instead of burning the whole check
        // budget as "transient".
        const body = JSON.stringify(err?.data || {});
        const handleError = this.handleErrors(body);

        if (err?.code === 401 || handleError?.type === 'refresh-token') {
          throw new RefreshToken(this.identifier, body, Buffer.from('{}'));
        }

        if (handleError?.type === 'bad-body') {
          throw new BadBody(
            this.identifier,
            body,
            Buffer.from('{}'),
            handleError.value
          );
        }

        // Transient status-check error: the media may finish transcoding just
        // fine, keep polling - if X stays broken the workflow exhausts its
        // checks and warns the user properly.
        return { status: 'pending', pendingData };
      }

      if (processing?.state === 'failed') {
        throw new BadBody(
          this.identifier,
          JSON.stringify(processing),
          Buffer.from('{}'),
          `X failed to process the uploaded video${processing?.error?.message ? `: ${processing.error.message}` : ''
          }`
        );
      }

      // A missing processing_info means the media is ready to use.
      if (processing && processing.state !== 'succeeded') {
        stillProcessing.push(mediaId);
      }
    }

    if (stillProcessing.length) {
      return {
        status: 'pending',
        pendingData: { ...pendingData, processingIds: stillProcessing },
      };
    }

    // witness the armed create so finalizePost knows the attempt is uniquely
    // accounted for before it mutates anything
    if (pendingData.attempting && !pendingData.confirmed) {
      return {
        status: 'ready',
        pendingData: { ...pendingData, processingIds: [], confirmed: true },
      };
    }

    return {
      status: 'ready',
      pendingData: { ...pendingData, processingIds: [] },
    };
  }

  // Converts the editor HTML (already sanitized by stripHtmlValidation's
  // 'html' mode - only p, h1-h3, ul, li, strong, u and a survive) into the
  // content_state the X Articles API expects, embedding the post media as
  // atomic image blocks at the end (the cover travels separately).
  // X's schema is a snake_case Draft.js dialect with additionalProperties
  // disallowed: blocks only accept key/text/type/data/entity_ranges/
  // inline_style_ranges (no depth).
  private articleContentState(html: string, embeddedMediaIds: string[]) {
    const blocks: any[] = [];
    const entities: any[] = [];

    const walkInline = (
      node: any,
      ctx: { text: string; styles: any[]; entityRanges: any[] }
    ) => {
      for (const child of node.childNodes || []) {
        if (child.nodeName === '#text') {
          ctx.text += child.value || '';
          continue;
        }

        const offset = ctx.text.length;
        walkInline(child, ctx);
        const length = ctx.text.length - offset;
        if (!length) {
          continue;
        }

        if (child.nodeName === 'strong') {
          ctx.styles.push({ offset, length, style: 'bold' });
        }

        if (child.nodeName === 'a') {
          const url = (child.attrs || []).find(
            (a: any) => a.name === 'href'
          )?.value;
          if (url) {
            const key = entities.length;
            entities.push({
              key: String(key),
              value: {
                type: 'link',
                mutability: 'mutable',
                data: { url },
              },
            });
            ctx.entityRanges.push({ offset, length, key });
          }
        }
      }
    };

    const makeBlock = (
      text: string,
      type: string,
      styles: any[] = [],
      entityRanges: any[] = []
    ) => ({
      key: `b${blocks.length}`,
      text,
      type,
      ...(styles.length ? { inline_style_ranges: styles } : {}),
      ...(entityRanges.length ? { entity_ranges: entityRanges } : {}),
    });

    const pushBlock = (node: any, type: string) => {
      const ctx = { text: '', styles: [] as any[], entityRanges: [] as any[] };
      walkInline(node, ctx);
      if (!ctx.text.trim()) {
        return;
      }
      blocks.push(makeBlock(ctx.text, type, ctx.styles, ctx.entityRanges));
    };

    const fragment = parseFragment(html) as any;
    for (const node of fragment.childNodes || []) {
      switch (node.nodeName) {
        case 'h1':
          pushBlock(node, 'header-one');
          break;
        case 'h2':
          pushBlock(node, 'header-two');
          break;
        case 'h3':
          // header-three is documented as valid but X's draft endpoint 503s on
          // it (https://devcommunity.x.com/t/-/271312), downgrade to header-two
          // until X fixes their side.
          pushBlock(node, 'header-two');
          break;
        case 'ul':
        case 'ol':
          for (const li of (node.childNodes || []).filter(
            (n: any) => n.nodeName === 'li'
          )) {
            pushBlock(
              li,
              node.nodeName === 'ol'
                ? 'ordered-list-item'
                : 'unordered-list-item'
            );
          }
          break;
        case '#text':
          if ((node.value || '').trim()) {
            blocks.push(makeBlock(node.value, 'unstyled'));
          }
          break;
        default:
          pushBlock(node, 'unstyled');
          break;
      }
    }

    // The API requires at least one block.
    if (!blocks.length) {
      blocks.push(makeBlock(stripHtmlValidation('none', html), 'unstyled'));
    }

    for (const mediaId of embeddedMediaIds) {
      const key = entities.length;
      entities.push({
        key: String(key),
        value: {
          type: 'image',
          mutability: 'immutable',
          data: {
            media_items: [
              // Must match the category the media was uploaded with -
              // lowercase, like the upload endpoint (the uppercase
              // TWEET_IMAGE in the docs example is wrong).
              { media_category: 'tweet_image', media_id: mediaId },
            ],
          },
        },
      });
      blocks.push(
        makeBlock(' ', 'atomic', [], [{ offset: 0, length: 1, key }])
      );
    }

    return { blocks, entities };
  }

  private async finalizeArticle(
    accessToken: string,
    pendingData: XPendingData,
    integration: Integration
  ): Promise<PendingCheckResponse> {
    const [accessTokenSplit, accessSecretSplit] = accessToken.split(':');
    const settings = pendingData.settings || {};
    const coverMediaId = pendingData.coverMediaId;
    // All the post media is embedded in the article body; the cover comes
    // from its own settings field.
    const embeddedMediaIds = (pendingData.mediaIds || []).filter((f) => f);

    const draftUrl = 'https://api.x.com/2/articles/draft';
    const draftResponse = await this.fetch(draftUrl, {
      method: 'POST',
      headers: {
        Authorization: this.signOAuth1(
          'POST',
          draftUrl,
          accessTokenSplit,
          accessSecretSplit
        ),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: settings.article_title,
        content_state: this.articleContentState(
          pendingData.message,
          embeddedMediaIds
        ),
        ...(coverMediaId
          ? {
            cover_media: {
              // Lowercase, matching the category the upload stored.
              media_category: 'tweet_image',
              media_id: coverMediaId,
            },
          }
          : {}),
      }),
    });
    const draftJson = (await draftResponse.json()) as {
      data?: { id: string };
      errors?: any[];
    };

    // The articles endpoints can return 2xx with an errors array (e.g. a
    // rejected cover) - don't swallow it.
    if (draftJson?.errors?.length) {
      console.log(
        'X article draft returned errors:',
        JSON.stringify(draftJson.errors)
      );
    }

    if (!draftJson?.data?.id) {
      throw new BadBody(
        this.identifier,
        JSON.stringify(draftJson),
        Buffer.from('{}'),
        'X could not create the article draft'
      );
    }

    if (settings.article_status !== 'published') {
      return {
        status: 'completed',
        postId: draftJson.data.id,
        releaseURL: `https://x.com/i/articles`,
      };
    }

    const publishUrl = `https://api.x.com/2/articles/${draftJson.data.id}/publish`;
    const publishResponse = await this.fetch(publishUrl, {
      method: 'POST',
      headers: {
        Authorization: this.signOAuth1(
          'POST',
          publishUrl,
          accessTokenSplit,
          accessSecretSplit
        ),
        'Content-Type': 'application/json',
      },
    });
    const publishJson = (await publishResponse.json()) as {
      data?: { post_id: string };
      errors?: any[];
    };

    if (publishJson?.errors?.length) {
      console.log(
        'X article publish returned errors:',
        JSON.stringify(publishJson.errors)
      );
    }

    if (!publishJson?.data?.post_id) {
      throw new BadBody(
        this.identifier,
        JSON.stringify(publishJson),
        Buffer.from('{}'),
        'X created the article draft but could not publish it, check your drafts on X'
      );
    }

    return {
      status: 'completed',
      postId: publishJson.data.post_id,
      releaseURL: `https://twitter.com/${integration.profile}/status/${publishJson.data.post_id}`,
    };
  }

  override async finalizePost(
    accessToken: string,
    pendingData: XPendingData,
    integration: Integration
  ): Promise<PendingCheckResponse> {
    // Create with an arm -> confirm -> publish handshake: the create only runs
    // after checkPostStatus witnessed the intent, so a run that dies
    // mid-create is detectable and the tweet is never published twice. The
    // same protection covers articles - creating a draft isn't idempotent
    // either.
    if (!pendingData.attempting || !pendingData.confirmed) {
      return {
        status: 'pending',
        pendingData: { ...pendingData, attempting: true, confirmed: false },
      };
    }

    if (pendingData.settings?.post_type === 'article') {
      return this.finalizeArticle(accessToken, pendingData, integration);
    }

    const [accessTokenSplit, accessSecretSplit] = accessToken.split(':');
    const settings = pendingData.settings || {};
    const mediaIds = (pendingData.mediaIds || []).filter((f) => f);

    const tweetUrl = 'https://api.x.com/2/tweets';
    const tweetBody = {
      ...(!settings.who_can_reply_post ||
        settings.who_can_reply_post === 'everyone'
        ? {}
        : {
          reply_settings: settings.who_can_reply_post,
        }),
      ...(settings.community
        ? {
          share_with_followers: true,
          community_id: settings.community?.split('/').pop() || '',
        }
        : {}),
      text: this.stripLinks()
        ? removeLinks(pendingData.message)
        : pendingData.message,
      ...(mediaIds.length ? { media: { media_ids: mediaIds } } : {}),
      made_with_ai: this.assetBoolean(settings.made_with_ai),
      paid_partnership: this.assetBoolean(settings.paid_partnership),
    };

    const tweetResponse = await this.fetch(tweetUrl, {
      method: 'POST',
      headers: {
        Authorization: this.signOAuth1(
          'POST',
          tweetUrl,
          accessTokenSplit,
          accessSecretSplit
        ),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetBody),
    });
    const { data } = (await tweetResponse.json()) as {
      data: { id: string };
    };

    return {
      status: 'completed',
      postId: data.id,
      releaseURL: `https://twitter.com/${integration.profile}/status/${data.id}`,
    };
  }

  // Old blocking behavior, kept for workflow versions before v1.0.6 that still
  // run and don't know how to resolve a `pending` response - they wait for the
  // transcoding and create the tweet inside the activity like before.
  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails<{
      active_thread_finisher: boolean;
      thread_finisher: string;
      community?: string;
      who_can_reply_post:
      | 'everyone'
      | 'following'
      | 'mentionedUsers'
      | 'subscribers'
      | 'verified';
      made_with_ai?: boolean;
      paid_partnership?: boolean;
    }>[],
    integration: Integration
  ): Promise<PostResponse[]> {
    const [response] = await this.postPending(
      id,
      accessToken,
      postDetails,
      integration
    );

    let pendingData = response.pendingData;
    const started = Date.now();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Cap below the 10-minute activity timeout of the old workflows using
      // this method: failing here is safe (the tweet is only created once the
      // media is ready), timing the activity out is not - a retried activity
      // would upload and publish again.
      if (Date.now() - started > 8 * 60 * 1000) {
        throw new BadBody(
          this.identifier,
          '{}',
          Buffer.from('{}'),
          'X took too long to process the media, please try again'
        );
      }

      const check = await this.checkPostStatus(
        accessToken,
        pendingData,
        integration
      );

      if (check.status === 'pending') {
        pendingData = check.pendingData;
        await timer(20000);
        continue;
      }

      const result =
        check.status === 'ready'
          ? await this.finalizePost(accessToken, check.pendingData, integration)
          : check;

      if (result.status === 'completed') {
        return [
          {
            postId: result.postId,
            id: response.id,
            releaseURL: result.releaseURL,
            status: 'posted',
          },
        ];
      }

      // finalize only armed the handshake (nothing to wait for), loop straight
      // into the witnessing check
      pendingData = result.pendingData;
    }
  }

  async comment(
    id: string,
    postId: string,
    lastCommentId: string | undefined,
    accessToken: string,
    postDetails: PostDetails<{
      active_thread_finisher: boolean;
      thread_finisher: string;
      made_with_ai?: boolean;
      paid_partnership?: boolean;
    }>[],
    integration: Integration
  ): Promise<PostResponse[]> {
    const [accessTokenSplit, accessSecretSplit] = accessToken.split(':');
    const client = await this.getClient(accessToken);
    const [commentPost] = postDetails;

    // upload media for the comment
    const uploadAll = await this.uploadMedia(client, [commentPost]);

    const media_ids = (uploadAll[commentPost.id] || []).filter((f) => f);

    const replyToId = lastCommentId || postId;

    // Comments are always tweets - flatten the editor HTML to plain text.
    const commentText = this.toTweetText(commentPost.message);

    const tweetUrl = 'https://api.x.com/2/tweets';
    const tweetBody = {
      text: this.stripLinks() ? removeLinks(commentText) : commentText,
      ...(media_ids.length ? { media: { media_ids } } : {}),
      reply: { in_reply_to_tweet_id: replyToId },
      made_with_ai: this.assetBoolean(commentPost?.settings?.made_with_ai),
      paid_partnership: this.assetBoolean(
        commentPost?.settings?.paid_partnership
      ),
    };

    const tweetResponse = await this.fetch(tweetUrl, {
      method: 'POST',
      headers: {
        Authorization: this.signOAuth1(
          'POST',
          tweetUrl,
          accessTokenSplit,
          accessSecretSplit
        ),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetBody),
    });
    const { data } = (await tweetResponse.json()) as {
      data: { id: string };
    };

    return [
      {
        postId: data.id,
        id: commentPost.id,
        releaseURL: `https://twitter.com/${integration.profile}/status/${data.id}`,
        status: 'posted',
      },
    ];
  }

  private loadAllTweets = async (
    client: TwitterApi,
    id: string,
    until: string,
    since: string,
    token = ''
  ): Promise<TweetV2[]> => {
    const tweets = await client.v2.userTimeline(id, {
      'tweet.fields': ['id'],
      'user.fields': [],
      'poll.fields': [],
      'place.fields': [],
      'media.fields': [],
      exclude: ['replies', 'retweets'],
      start_time: since,
      end_time: until,
      max_results: 100,
      ...(token ? { pagination_token: token } : {}),
    });

    return [
      ...tweets.data.data,
      ...(tweets.data.data.length === 100
        ? await this.loadAllTweets(
          client,
          id,
          until,
          since,
          tweets.meta.next_token
        )
        : []),
    ];
  };

  private async captureAnalyticsSnapshot(
    request: ChannelAnalyticsCaptureRequest
  ): Promise<ChannelAnalyticsCapturePage> {
    const [accessToken, accessSecret] = request.accessToken.split(':');
    const client = new TwitterApi({
      appKey: process.env.X_API_KEY!,
      appSecret: process.env.X_API_SECRET!,
      accessToken,
      accessSecret,
    });
    const until = dayjs
      .utc(request.toDay || request.snapshotAt)
      .endOf('day');
    const since = dayjs
      .utc(
        request.fromDay || dayjs.utc(request.snapshotAt).subtract(100, 'day')
      )
      .startOf('day');
    const timeline = await client.v2.userTimeline(request.integration.internalId, {
      'tweet.fields': ['id'],
      'user.fields': [],
      'poll.fields': [],
      'place.fields': [],
      'media.fields': [],
      exclude: ['replies', 'retweets'],
      start_time: since.format('YYYY-MM-DDTHH:mm:ssZ'),
      end_time: until.format('YYYY-MM-DDTHH:mm:ssZ'),
      max_results: Math.min(Math.max(request.pageSize, 1), 100),
      ...(request.cursor ? { pagination_token: request.cursor } : {}),
    });
    const tweetIds = timeline.data.data.map((tweet) => tweet.id);
    if (!tweetIds.length) {
      return {
        kind: 'post_lifetime',
        points: [],
        ...(timeline.meta.next_token
          ? { nextCursor: timeline.meta.next_token }
          : {}),
      };
    }

    const tweets = await client.v2.tweets(tweetIds, {
      'tweet.fields': ['public_metrics'],
    });
    const metricLabels: Record<string, string> = {
      impression_count: 'Impressions',
      bookmark_count: 'Bookmarks',
      like_count: 'Likes',
      quote_count: 'Quotes',
      reply_count: 'Replies',
      retweet_count: 'Retweets',
    };

    return {
      kind: 'post_lifetime',
      points: tweets.data.flatMap((tweet) =>
        Object.entries(metricLabels).flatMap(([metricKey, label]) => {
          const value = tweet.public_metrics?.[
            metricKey as keyof typeof tweet.public_metrics
          ];
          return typeof value === 'number'
            ? [
                {
                  externalPostId: tweet.id,
                  metricKey,
                  label,
                  valueMode: 'sum' as const,
                  value,
                },
              ]
            : [];
        })
      ),
      ...(timeline.meta.next_token
        ? { nextCursor: timeline.meta.next_token }
        : {}),
    };
  }

  async analytics(
    id: string,
    accessToken: string,
    date: number
  ): Promise<AnalyticsData[]> {
    if (process.env.DISABLE_X_ANALYTICS) {
      return [];
    }

    const until = dayjs().endOf('day');
    const since = dayjs().subtract(date > 100 ? 100 : date, 'day');

    const [accessTokenSplit, accessSecretSplit] = accessToken.split(':');
    const client = new TwitterApi({
      appKey: process.env.X_API_KEY!,
      appSecret: process.env.X_API_SECRET!,
      accessToken: accessTokenSplit,
      accessSecret: accessSecretSplit,
    });

    try {
      const tweets = uniqBy(
        await this.loadAllTweets(
          client,
          id,
          until.format('YYYY-MM-DDTHH:mm:ssZ'),
          since.format('YYYY-MM-DDTHH:mm:ssZ')
        ),
        (p) => p.id
      );

      if (tweets.length === 0) {
        return [];
      }

      const data = await client.v2.tweets(
        tweets.map((p) => p.id),
        {
          'tweet.fields': ['public_metrics'],
        }
      );

      const metrics = data.data.reduce(
        (all, current) => {
          all.impression_count =
            (all.impression_count || 0) +
            +current.public_metrics.impression_count;
          all.bookmark_count =
            (all.bookmark_count || 0) + +current.public_metrics.bookmark_count;
          all.like_count =
            (all.like_count || 0) + +current.public_metrics.like_count;
          all.quote_count =
            (all.quote_count || 0) + +current.public_metrics.quote_count;
          all.reply_count =
            (all.reply_count || 0) + +current.public_metrics.reply_count;
          all.retweet_count =
            (all.retweet_count || 0) + +current.public_metrics.retweet_count;

          return all;
        },
        {
          impression_count: 0,
          bookmark_count: 0,
          like_count: 0,
          quote_count: 0,
          reply_count: 0,
          retweet_count: 0,
        }
      );

      return Object.entries(metrics).map(([key, value]) => ({
        label: key.replace('_count', '').replace('_', ' ').toUpperCase(),
        percentageChange: 5,
        data: [
          {
            total: String(0),
            date: since.format('YYYY-MM-DD'),
          },
          {
            total: String(value),
            date: until.format('YYYY-MM-DD'),
          },
        ],
      }));
    } catch (err) {
      console.log(err);
    }
    return [];
  }

  async postAnalytics(
    integrationId: string,
    accessToken: string,
    postId: string,
    date: number
  ): Promise<AnalyticsData[]> {
    if (process.env.DISABLE_X_ANALYTICS) {
      return [];
    }

    const today = dayjs().format('YYYY-MM-DD');

    const [accessTokenSplit, accessSecretSplit] = accessToken.split(':');
    const client = new TwitterApi({
      appKey: process.env.X_API_KEY!,
      appSecret: process.env.X_API_SECRET!,
      accessToken: accessTokenSplit,
      accessSecret: accessSecretSplit,
    });

    try {
      // Fetch the specific tweet with public metrics
      const tweet = await client.v2.singleTweet(postId, {
        'tweet.fields': ['public_metrics', 'created_at'],
      });

      if (!tweet?.data?.public_metrics) {
        return [];
      }

      const metrics = tweet.data.public_metrics;

      const result: AnalyticsData[] = [];

      if (metrics.impression_count !== undefined) {
        result.push({
          label: 'Impressions',
          percentageChange: 0,
          data: [{ total: String(metrics.impression_count), date: today }],
        });
      }

      if (metrics.like_count !== undefined) {
        result.push({
          label: 'Likes',
          percentageChange: 0,
          data: [{ total: String(metrics.like_count), date: today }],
        });
      }

      if (metrics.retweet_count !== undefined) {
        result.push({
          label: 'Retweets',
          percentageChange: 0,
          data: [{ total: String(metrics.retweet_count), date: today }],
        });
      }

      if (metrics.reply_count !== undefined) {
        result.push({
          label: 'Replies',
          percentageChange: 0,
          data: [{ total: String(metrics.reply_count), date: today }],
        });
      }

      if (metrics.quote_count !== undefined) {
        result.push({
          label: 'Quotes',
          percentageChange: 0,
          data: [{ total: String(metrics.quote_count), date: today }],
        });
      }

      if (metrics.bookmark_count !== undefined) {
        result.push({
          label: 'Bookmarks',
          percentageChange: 0,
          data: [{ total: String(metrics.bookmark_count), date: today }],
        });
      }

      return result;
    } catch (err) {
      console.log('Error fetching X post analytics:', err);
    }

    return [];
  }

  override async mention(token: string, d: { query: string }) {
    const [accessTokenSplit, accessSecretSplit] = token.split(':');
    const client = new TwitterApi({
      appKey: process.env.X_API_KEY!,
      appSecret: process.env.X_API_SECRET!,
      accessToken: accessTokenSplit,
      accessSecret: accessSecretSplit,
    });

    try {
      const data = await client.v2.userByUsername(d.query, {
        'user.fields': ['username', 'name', 'profile_image_url'],
      });

      if (!data?.data?.username) {
        return [];
      }

      return [
        {
          id: data.data.username,
          image: data.data.profile_image_url,
          label: data.data.name,
        },
      ];
    } catch (err) {
      console.log(err);
    }
    return [];
  }

  mentionFormat(idOrHandle: string, name: string) {
    return `@${idOrHandle}`;
  }
}
