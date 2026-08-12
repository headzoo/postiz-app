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
  const handle = follower.username ? `@${follower.username}` : undefined;

  return (
    <article
      className={clsx(
        'flex flex-col gap-[12px] h-full',
        'bg-newTableHeader border border-newTableBorder rounded-[12px]',
        'p-[16px] transition-all duration-200 hover:border-newTextColor/20'
      )}
    >
      <div className="flex flex-1 items-start gap-[12px]">
        <ImageWithFallback
          fallbackSrc="/no-picture.jpg"
          src={follower.picture || '/no-picture.jpg'}
          className="rounded-full shrink-0 object-cover"
          alt={follower.name}
          width={48}
          height={48}
        />
        <div className="flex flex-1 min-w-0 flex-col gap-[12px] h-full">
          <div>
            <div className="flex items-start justify-between gap-[8px]">
              <div className="min-w-0">
                <h3 className="text-[15px] font-[600] text-newTextColor truncate">
                  {follower.name}
                </h3>
                {handle && (
                  <p className="text-[13px] text-textItemBlur truncate">
                    {handle}
                  </p>
                )}
              </div>
              {follower.profileUrl && (
                <a
                  href={follower.profileUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="shrink-0 text-[12px] text-newTextColor underline underline-offset-2 hover:opacity-80"
                  aria-label={t(
                    'followers_view_profile_for',
                    'View profile for {{name}}',
                    { name: follower.name }
                  )}
                >
                  {t('followers_view_profile', 'Profile')}
                </a>
              )}
            </div>
            {(Number.isFinite(follower.followingCount) ||
              Number.isFinite(follower.followersCount) ||
              Number.isFinite(follower.influenceScore)) && (
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
              <p className="mt-[8px] text-[13px] text-textItemBlur line-clamp-3">
                {follower.bio}
              </p>
            )}
          </div>

          {(followedAt || accountCreatedAt) && (
            <div className="mt-auto flex flex-col gap-[4px] text-[12px] text-textItemBlur">
              {followedAt && (
                <span>
                  {t('followers_followed_at', 'Followed {{date}}', {
                    date: followedAt,
                  })}
                </span>
              )}
              {accountCreatedAt && (
                <span>
                  {t('followers_account_created_at', 'Joined {{date}}', {
                    date: accountCreatedAt,
                  })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
