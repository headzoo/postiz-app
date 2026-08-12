'use client';

import { FC } from 'react';
import clsx from 'clsx';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Follower } from '@gitroom/frontend/components/followers/use.followers';

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatCompactCount = (value: number) => {
  const count = Math.abs(Math.round(value));
  if (count < 10000) {
    return count.toLocaleString('en-US');
  }
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(count);
};

export const FollowerCard: FC<{
  follower: Follower;
}> = ({ follower }) => {
  const t = useT();
  const followedAt = follower.followedAt
    ? formatDate(follower.followedAt)
    : null;
  const accountCreatedAt = follower.accountCreatedAt
    ? formatDate(follower.accountCreatedAt)
    : null;
  const lastInteractionAt = follower.lastInteractionAt
    ? formatDate(follower.lastInteractionAt)
    : null;
  const handle = follower.username ? `@${follower.username}` : undefined;
  const hasInteractionMetrics =
    Number.isFinite(follower.interactionCount) ||
    Number.isFinite(follower.interactionScore) ||
    !!lastInteractionAt;

  return (
    <article
      className={clsx(
        'flex flex-col gap-[12px] h-full',
        'bg-newTableHeader border border-newTableBorder rounded-[12px]',
        'p-[16px] transition-all duration-200 hover:border-newTextColor/20'
      )}
    >
      <div className="flex flex-1 items-start gap-[12px]">
        {follower.profileUrl ? (
          <a
            href={follower.profileUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="shrink-0 rounded-full hover:opacity-80"
            aria-label={t(
              'followers_view_profile_for',
              'View profile for {{name}}',
              { name: follower.name }
            )}
          >
            <ImageWithFallback
              fallbackSrc="/no-picture.jpg"
              src={follower.picture || '/no-picture.jpg'}
              className="rounded-full shrink-0 object-cover"
              alt={follower.name}
              width={48}
              height={48}
            />
          </a>
        ) : (
          <ImageWithFallback
            fallbackSrc="/no-picture.jpg"
            src={follower.picture || '/no-picture.jpg'}
            className="rounded-full shrink-0 object-cover"
            alt={follower.name}
            width={48}
            height={48}
          />
        )}
        <div className="flex flex-1 min-w-0 flex-col gap-[12px] h-full">
          <div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-[600] text-newTextColor truncate">
                {follower.name}
              </h3>
              {handle &&
                (follower.profileUrl ? (
                  <a
                    href={follower.profileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[13px] text-textItemBlur truncate hover:underline hover:opacity-80 block"
                  >
                    {handle}
                  </a>
                ) : (
                  <p className="text-[13px] text-textItemBlur truncate">
                    {handle}
                  </p>
                ))}
            </div>

            {hasInteractionMetrics && (
              <div className="mt-[10px] flex flex-col gap-[4px]">
                {Number.isFinite(follower.interactionCount) && (
                  <div className="flex items-baseline gap-[8px]">
                    <span className="text-[22px] font-[700] leading-none text-newTextColor">
                      {formatCompactCount(follower.interactionCount!)}
                    </span>
                    <span className="text-[13px] text-textItemBlur">
                      {t('followers_interaction_count', 'Interactions')}
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-[16px] gap-y-[4px] text-[12px] text-textItemBlur">
                  {Number.isFinite(follower.interactionScore) && (
                    <span>
                      {t('followers_quality_score', 'Quality score {{score}}', {
                        score: follower.interactionScore!,
                      })}
                    </span>
                  )}
                  {lastInteractionAt && (
                    <span>
                      {t(
                        'followers_last_interaction',
                        'Last interaction {{date}}',
                        { date: lastInteractionAt }
                      )}
                    </span>
                  )}
                </div>
              </div>
            )}

            {(Number.isFinite(follower.followingCount) ||
              Number.isFinite(follower.followersCount) ||
              Number.isFinite(follower.influenceScore) ||
              accountCreatedAt) && (
                <div className="mt-[6px] flex flex-wrap items-center gap-x-[20px] gap-y-[6px] text-[13px]">
                  {Number.isFinite(follower.followingCount) && (
                    <span>
                      <span className="font-[700] text-newTextColor">
                        {formatCompactCount(follower.followingCount!)}
                      </span>{' '}
                      <span className="text-textItemBlur">
                        {t('followers_following_label', 'Following')}
                      </span>
                    </span>
                  )}
                  {Number.isFinite(follower.followersCount) && (
                    <span>
                      <span className="font-[700] text-newTextColor">
                        {formatCompactCount(follower.followersCount!)}
                      </span>{' '}
                      <span className="text-textItemBlur">
                        {t('followers_followers_label', 'Followers')}
                      </span>
                    </span>
                  )}
                  {accountCreatedAt && (
                    <span>
                      <span className="font-[700] text-newTextColor">
                        {t('followers_joined_label', 'Joined')}
                      </span>{' '}
                      <span className="text-textItemBlur">{accountCreatedAt}</span>
                    </span>
                  )}
                  {Number.isFinite(follower.influenceScore) && (
                    <span className="text-textItemBlur">
                      {t('followers_recommendation_score', 'Score {{score}}', {
                        score: follower.influenceScore!,
                      })}
                    </span>
                  )}
                </div>
              )}
            {follower.bio && (
              <p className="mt-[8px] text-[13px] text-newTextColor line-clamp-3">
                {follower.bio}
              </p>
            )}
          </div>

          {followedAt && (
            <div className="mt-auto flex flex-col gap-[4px] text-[12px] text-textItemBlur">
              <span>
                {t('followers_followed_at', 'Followed {{date}}', {
                  date: followedAt,
                })}
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
