'use client';

import { FC, KeyboardEvent, MouseEvent, useCallback } from 'react';
import clsx from 'clsx';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useDecisionModal } from '@gitroom/frontend/components/layout/new-modal';
import { Follower, FollowerList, DismissibleTriage } from '@gitroom/frontend/components/followers/use.followers';
import { RelationshipStars } from '@gitroom/frontend/components/followers/follower.relationship.stars';
import { FollowerListDropdown } from '@gitroom/frontend/components/followers/follower.list.dropdown';

const TRIAGE_LABELS: Record<
  DismissibleTriage,
  { key: string; defaultLabel: string }
> = {
  hot_lead: {
    key: 'followers_triage_hot_lead',
    defaultLabel: 'Hot',
  },
  mutual: {
    key: 'followers_triage_mutual',
    defaultLabel: 'Mutual',
  },
  over_invested: {
    key: 'followers_triage_over_invested',
    defaultLabel: 'Costly',
  },
  quiet: {
    key: 'followers_triage_quiet',
    defaultLabel: 'Quiet',
  },
  lead: {
    key: 'followers_audience_lead',
    defaultLabel: 'Lead',
  },
};

const TRIAGE_STYLES: Record<DismissibleTriage, string> = {
  hot_lead: 'border-amber-500/40 text-amber-500',
  mutual: 'border-green-500/40 text-green-500',
  over_invested: 'border-red-400/40 text-red-400',
  quiet: 'border-newTableBorder text-textItemBlur',
  lead: 'border-sky-500/40 text-sky-500',
};

export const RelationshipTriageBadge: FC<{
  triage: DismissibleTriage;
  onRemove?: (triage: DismissibleTriage) => Promise<void> | void;
}> = ({ triage, onRemove }) => {
  const t = useT();
  const decision = useDecisionModal();
  const label = TRIAGE_LABELS[triage];
  const displayLabel = t(label.key, label.defaultLabel);

  const handleClick = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      event.preventDefault();
      if (!onRemove) {
        return;
      }
      const approved = await decision.open({
        title: t('followers_triage_remove_title', 'Remove {{label}} badge?', {
          label: displayLabel,
        }),
        description: t(
          'followers_triage_remove_description',
          'This follower will be removed from the {{label}} list.',
          { label: displayLabel }
        ),
        approveLabel: t('yes', 'Yes'),
        cancelLabel: t('cancel', 'Cancel'),
      });
      if (!approved) {
        return;
      }
      await onRemove(triage);
    },
    [decision, displayLabel, onRemove, t, triage]
  );

  const className = clsx(
    'inline-flex w-fit shrink-0 items-center rounded-full border px-[8px] py-[2px] text-[11px] font-[600]',
    TRIAGE_STYLES[triage],
    onRemove && 'cursor-pointer hover:opacity-80'
  );

  if (!onRemove) {
    return <span className={className}>{displayLabel}</span>;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      onKeyDown={(event) => event.stopPropagation()}
      aria-label={t('followers_triage_remove_aria', 'Remove {{label}} badge', {
        label: displayLabel,
      })}
    >
      {displayLabel}
    </button>
  );
};

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
  lists?: FollowerList[];
  onToggleList?: (list: FollowerList, assigned: boolean) => Promise<void> | void;
  onDismissTriage?: (triage: DismissibleTriage) => Promise<void> | void;
  onOpen?: () => void;
}> = ({ follower, lists = [], onToggleList, onDismissTriage, onOpen }) => {
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
  const hasInteractionCount = Number.isFinite(follower.interactionCount);
  const hasNoteCount = Number.isFinite(follower.noteCount);
  const hasLikesCount = Number.isFinite(follower.likesCount);
  const hasFollowingCount = Number.isFinite(follower.followingCount);
  const hasFollowersCount = Number.isFinite(follower.followersCount);
  const hasInfluenceScore = Number.isFinite(follower.influenceScore);
  const hasMetricsGrid =
    hasFollowingCount ||
    hasFollowersCount ||
    hasLikesCount ||
    hasNoteCount ||
    hasInteractionCount ||
    hasInfluenceScore;
  const hasSecondaryInteractionMetrics =
    Number.isFinite(follower.interactionScore) || !!lastInteractionAt;
  const hasRelationshipEffort =
    follower.effortStars !== undefined ||
    follower.reciprocationStars !== undefined ||
    follower.myGrade !== undefined ||
    follower.relationshipTriage != null;

  const handleCardClick = () => {
    onOpen?.();
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onOpen) {
      return;
    }
    if (
      event.target instanceof HTMLElement &&
      event.target.closest('a[href]')
    ) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };

  const stopProfileNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
  };

  const stopProfileKeyboard = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.stopPropagation();
    }
  };

  return (
    <article
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen ? handleCardClick : undefined}
      onKeyDown={onOpen ? handleCardKeyDown : undefined}
      className={clsx(
        'flex flex-col gap-[12px] h-full',
        'bg-newTableHeader border border-newTableBorder rounded-[12px]',
        'p-[16px] transition-all duration-200 hover:border-newTextColor/20',
        onOpen && 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-newTextColor/30'
      )}
    >
      <div className="flex flex-1 items-start gap-[12px]">
        {follower.profileUrl ? (
          <a
            href={follower.profileUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={stopProfileNavigation}
            onKeyDown={stopProfileKeyboard}
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
              <div className="flex min-w-0 flex-wrap items-center gap-[8px]">
                <h3 className="text-[15px] font-[600] text-newTextColor truncate">
                  {follower.name}
                </h3>
                {follower.isLead && (
                  <RelationshipTriageBadge
                    triage="lead"
                    onRemove={onDismissTriage}
                  />
                )}
                {follower.relationshipTriage && (
                  <RelationshipTriageBadge
                    triage={follower.relationshipTriage}
                    onRemove={onDismissTriage}
                  />
                )}
                {(follower.listIds ?? []).map((listId) => {
                  const list = lists.find((item) => item.id === listId);
                  if (!list) {
                    return null;
                  }
                  return (
                    <span
                      key={list.id}
                      className="inline-flex w-fit shrink-0 items-center rounded-full border border-newTableBorder px-[8px] py-[2px] text-[11px] font-[600] text-textItemBlur"
                    >
                      {list.name}
                    </span>
                  );
                })}
                {onToggleList && (
                  <FollowerListDropdown
                    lists={lists}
                    assignedListIds={follower.listIds ?? []}
                    onToggle={onToggleList}
                  />
                )}
              </div>
              {handle &&
                (follower.profileUrl ? (
                  <a
                    href={follower.profileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={stopProfileNavigation}
                    onKeyDown={stopProfileKeyboard}
                    className="mt-[2px] inline-block max-w-full shrink-0 text-[13px] text-textItemBlur truncate hover:underline hover:opacity-80"
                  >
                    {handle}
                  </a>
                ) : (
                  <span className="mt-[2px] inline-block max-w-full shrink-0 text-[13px] text-textItemBlur truncate">
                    {handle}
                  </span>
                ))}
            </div>

            {accountCreatedAt && (
              <div className="mt-[4px] min-w-0 overflow-hidden whitespace-nowrap text-[13px]">
                <span className="font-[700] text-newTextColor">
                  {t('followers_joined_label', 'Joined')}
                </span>{' '}
                <span className="text-textItemBlur">{accountCreatedAt}</span>
              </div>
            )}

            {hasSecondaryInteractionMetrics && (
              <div className="mt-[6px] flex flex-wrap items-center gap-x-[16px] gap-y-[4px] text-[12px] text-textItemBlur">
                {Number.isFinite(follower.interactionScore) && (
                  <span>
                    {t('followers_activity_score', 'Activity score {{score}}', {
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
            )}

            {(hasRelationshipEffort || hasMetricsGrid) && (
              <div
                data-follower-metrics-row=""
                className={clsx(
                  'mt-[8px] grid gap-x-[16px] gap-y-[8px]',
                  hasRelationshipEffort && hasMetricsGrid
                    ? 'grid-cols-[max-content_minmax(0,1fr)]'
                    : 'grid-cols-1'
                )}
              >
                {hasRelationshipEffort && (
                  <div className="grid grid-cols-[auto_auto] items-center gap-x-[8px] gap-y-[6px] text-[12px]">
                    <span className="text-textItemBlur">
                      {t('followers_card_grade', 'Grade')}
                    </span>
                    <RelationshipStars
                      grade={follower.myGrade ?? null}
                      compact={true}
                    />
                    <span className="text-textItemBlur">
                      {t('followers_card_them', 'Them')}
                    </span>
                    <RelationshipStars
                      grade={follower.reciprocationStars ?? null}
                      compact={true}
                    />
                    <span className="text-textItemBlur">
                      {t('followers_card_you', 'You')}
                    </span>
                    <RelationshipStars
                      grade={follower.effortStars ?? null}
                      compact={true}
                    />
                  </div>
                )}
                {hasMetricsGrid && (
                  <div className="grid min-w-0 grid-cols-2 gap-x-[12px] gap-y-[6px] text-[13px]">
                    {hasFollowingCount && (
                      <span className="whitespace-nowrap">
                        <span className="font-[700] text-newTextColor">
                          {formatCompactCount(follower.followingCount!)}
                        </span>{' '}
                        <span className="text-textItemBlur">
                          {t('followers_following_label', 'Following')}
                        </span>
                      </span>
                    )}
                    {hasFollowersCount && (
                      <span className="whitespace-nowrap">
                        <span className="font-[700] text-newTextColor">
                          {formatCompactCount(follower.followersCount!)}
                        </span>{' '}
                        <span className="text-textItemBlur">
                          {t('followers_followers_label', 'Followers')}
                        </span>
                      </span>
                    )}
                    {hasLikesCount && (
                      <span className="whitespace-nowrap">
                        <span className="font-[700] text-newTextColor">
                          {formatCompactCount(follower.likesCount!)}
                        </span>{' '}
                        <span className="text-textItemBlur">
                          {t('followers_like_count', 'likes')}
                        </span>
                      </span>
                    )}
                    {hasNoteCount && (
                      <span className="whitespace-nowrap">
                        <span className="font-[700] text-newTextColor">
                          {formatCompactCount(follower.noteCount!)}
                        </span>{' '}
                        <span className="text-textItemBlur">
                          {t('followers_note_count', 'notes')}
                        </span>
                      </span>
                    )}
                    {hasInteractionCount && (
                      <span className="whitespace-nowrap">
                        <span className="font-[700] text-newTextColor">
                          {formatCompactCount(follower.interactionCount!)}
                        </span>{' '}
                        <span className="text-textItemBlur">
                          {t('followers_interaction_count', 'interactions')}
                        </span>
                      </span>
                    )}
                    {hasInfluenceScore && (
                      <span className="text-textItemBlur">
                        {t(
                          'followers_recommendation_score',
                          'Score {{score}}',
                          {
                            score: follower.influenceScore!,
                          }
                        )}
                      </span>
                    )}
                  </div>
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
