'use client';

import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useDebounce } from 'use-debounce';
import { useRouter } from 'next/navigation';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { Select } from '@gitroom/react/form/select';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { FollowerCard } from '@gitroom/frontend/components/followers/follower.card';
import { FollowerDetailModal } from '@gitroom/frontend/components/followers/follower.detail.modal';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import {
  ChannelMenu,
  ChannelsSidebar,
  groupChannelsByCustomer,
} from '@gitroom/frontend/components/launches/channels.sidebar';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import {
  ChannelInteractionKindCoverage,
  ChannelInteractionWindow,
  DEFAULT_FOLLOWER_INTERACTION_WINDOW,
  FOLLOWER_INTERACTION_WINDOWS,
  FollowerChannel,
  FollowerPageTracking,
  FollowerSortDirection,
  Follower,
  useFollowerChannels,
  useFollowers,
} from '@gitroom/frontend/components/followers/use.followers';

const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;

const INTERACTION_KIND_LABELS: Record<string, { key: string; defaultLabel: string }> = {
  like: { key: 'followers_interaction_kind_like', defaultLabel: 'Likes' },
  reply: { key: 'followers_interaction_kind_reply', defaultLabel: 'Replies' },
  repost: { key: 'followers_interaction_kind_repost', defaultLabel: 'Reposts' },
  follow: { key: 'followers_interaction_kind_follow', defaultLabel: 'Follows' },
  mention: { key: 'followers_interaction_kind_mention', defaultLabel: 'Mentions' },
};

const getPartialCoverageItems = (
  coverage?: ChannelInteractionKindCoverage[]
) =>
  coverage?.filter(
    (item) => item.inbound === 'partial' || item.outbound === 'partial'
  ) ?? [];

const formatTrackingTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const trackingUnavailableMessage = (
  category: FollowerPageTracking['failureCategory'],
  reason: string | undefined,
  t: ReturnType<typeof useT>
) => {
  if (reason) {
    return reason;
  }
  const messages = {
    configuration: [
      'followers_tracking_configuration',
      'Interaction tracking needs channel configuration before it can start.',
    ],
    authentication: [
      'followers_tracking_authentication',
      'Interaction tracking needs authentication. Reconnecting the channel may help.',
    ],
    authorization: [
      'followers_tracking_authorization',
      'Interaction tracking does not have the required channel permissions.',
    ],
    entitlement: [
      'followers_tracking_entitlement',
      'Your provider plan does not include this interaction tracking feature.',
    ],
    quota: [
      'followers_tracking_quota',
      'The provider tracking quota has been reached. Tracking will resume when capacity is available.',
    ],
    transient: [
      'followers_tracking_transient',
      'The provider is temporarily unavailable. We will retry tracking setup.',
    ],
    unknown: [
      'followers_tracking_unknown',
      'Interaction tracking could not be set up right now.',
    ],
  } as const;
  const message = messages[category || 'unknown'];
  return t(message[0], message[1]);
};

const FollowerCardSkeleton: FC = () => (
  <div
    className={clsx(
      'h-[220px] rounded-[12px] border border-newTableBorder bg-newTableHeader',
      'animate-pulse'
    )}
  />
);

const TrackingNotice: FC<{
  tracking?: FollowerPageTracking;
  showFreshness?: boolean;
}> = ({ tracking, showFreshness = false }) => {
  const t = useT();

  if (!tracking) {
    return null;
  }

  const partialCoverage = getPartialCoverageItems(tracking.coverage);
  const freshness = tracking.computedAt
    ? formatTrackingTimestamp(tracking.computedAt)
    : null;
  const isProvisioning = tracking.availability === 'provisioning';
  const isUnavailable = tracking.availability === 'unavailable';
  const showPartialNotice =
    tracking.state === 'partial' || partialCoverage.length > 0;
  const trackingStartedAt = tracking.trackingStartedAt
    ? formatTrackingTimestamp(tracking.trackingStartedAt)
    : null;

  if (
    !isProvisioning &&
    !isUnavailable &&
    !showPartialNotice &&
    !(showFreshness && freshness)
  ) {
    return null;
  }

  return (
    <div className="flex flex-col gap-[8px]">
      {isProvisioning && (
        <div className="rounded-[10px] border border-amber-500/30 bg-amber-500/10 px-[14px] py-[10px] text-[13px] text-amber-400">
          {t(
            'followers_tracking_provisioning',
            'Interaction tracking is still being set up for this channel. Rankings begin after tracking and the first follower sync complete.'
          )}
        </div>
      )}
      {isUnavailable && (
        <div className="rounded-[10px] border border-amber-500/30 bg-amber-500/10 px-[14px] py-[10px] text-[13px] text-amber-400">
          {t(
            'followers_tracking_unavailable',
            trackingUnavailableMessage(
              tracking.failureCategory,
              tracking.reason,
              t
            )
          )}
        </div>
      )}
      {showPartialNotice && (
        <div className="rounded-[10px] border border-amber-500/30 bg-amber-500/10 px-[14px] py-[10px] text-[13px] text-amber-400">
          <p>
            {t(
              'followers_tracking_partial',
              'Some interaction types have limited coverage. Rankings may be incomplete.'
            )}
          </p>
          {partialCoverage.length > 0 && (
            <ul className="mt-[6px] list-disc ps-[18px]">
              {partialCoverage.map((item) => {
                const label = INTERACTION_KIND_LABELS[item.kind];
                return (
                  <li key={item.kind}>
                    {item.reason ||
                      t(
                        label?.key || 'followers_interaction_kind_unknown',
                        label?.defaultLabel || item.kind
                      )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {showFreshness && freshness && (
        <p className="text-[13px] text-textItemBlur">
          {t('followers_tracking_freshness', 'Ranking summary computed {{date}}', {
            date: freshness,
          })}
        </p>
      )}
      {tracking.noBackfill && (
        <p className="text-[13px] text-textItemBlur">
          {trackingStartedAt
            ? t(
              'followers_tracking_no_backfill_since',
              'Rankings include events received after tracking began on {{date}}. Earlier provider activity is not backfilled.',
              { date: trackingStartedAt }
            )
            : t(
              'followers_tracking_no_backfill',
              'Rankings include only events received after tracking begins. Earlier provider activity is not backfilled.'
            )}
        </p>
      )}
    </div>
  );
};

export const FollowersComponent: FC = () => {
  const t = useT();
  const router = useRouter();
  const modal = useModals();
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>();
  const [sort, setSort] = useState<string>();
  const [direction, setDirection] = useState<FollowerSortDirection>();
  const [window, setWindow] = useState<ChannelInteractionWindow>(
    DEFAULT_FOLLOWER_INTERACTION_WINDOW
  );
  const [limit, setLimit] = useState<number>(24);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const trimmedSearch = debouncedSearch.trim();

  const {
    data: channels = [],
    isLoading: isLoadingChannels,
    error: channelsError,
    mutate: mutateChannels,
  } = useFollowerChannels();
  const { data: integrations = [], isLoading: isLoadingIntegrations } =
    useIntegrationList();
  const followerIntegrations = useMemo(() => {
    const followerIds = new Set(channels.map((channel) => channel.id));
    return integrations.filter((integration) => followerIds.has(integration.id));
  }, [channels, integrations]);
  const groupedFollowerIntegrations = useMemo(
    () => groupChannelsByCustomer(followerIntegrations),
    [followerIntegrations]
  );

  useEffect(() => {
    if (!channels.length) {
      setSelectedIntegrationId(undefined);
      return;
    }

    if (
      selectedIntegrationId &&
      channels.some((channel) => channel.id === selectedIntegrationId)
    ) {
      return;
    }

    const firstChannelId =
      groupedFollowerIntegrations[0]?.values[0]?.id || channels[0].id;
    const firstChannel =
      channels.find((channel) => channel.id === firstChannelId) || channels[0];
    setSelectedIntegrationId(firstChannel.id);
    const defaultSort = firstChannel.sorts[0];
    setSort(defaultSort?.key);
    setDirection(defaultSort?.defaultDirection);
    setWindow(DEFAULT_FOLLOWER_INTERACTION_WINDOW);
    setCursorHistory([]);
    setPageNumber(1);
  }, [channels, groupedFollowerIntegrations, selectedIntegrationId]);

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedIntegrationId),
    [channels, selectedIntegrationId]
  );

  const effectiveSort = sort ?? selectedChannel?.sorts[0]?.key;

  const activeSort = useMemo(
    () => selectedChannel?.sorts.find((item) => item.key === effectiveSort),
    [selectedChannel, effectiveSort]
  );

  const requiresWindow = !!activeSort?.requiresWindow;
  const isInteractionsSort = activeSort?.key === 'interactions';
  const isNotesSort = activeSort?.key === 'notes';

  const resetPagination = useCallback(() => {
    setCursorHistory([]);
    setPageNumber(1);
  }, []);

  const handleChannelSelect = useCallback(
    (channel: FollowerChannel) => {
      setSelectedIntegrationId(channel.id);
      const defaultSort = channel.sorts[0];
      setSort(defaultSort?.key);
      setDirection(defaultSort?.defaultDirection);
      setWindow(DEFAULT_FOLLOWER_INTERACTION_WINDOW);
      resetPagination();
    },
    [resetPagination]
  );

  const handleSortChange = useCallback(
    (value: string) => {
      setSort(value);
      const sortOption = selectedChannel?.sorts.find((item) => item.key === value);
      setDirection(sortOption?.defaultDirection);
      resetPagination();
    },
    [resetPagination, selectedChannel]
  );

  const handleDirectionChange = useCallback(
    (value: FollowerSortDirection) => {
      setDirection(value);
      resetPagination();
    },
    [resetPagination]
  );

  const handleWindowChange = useCallback(
    (value: ChannelInteractionWindow) => {
      setWindow(value);
      resetPagination();
    },
    [resetPagination]
  );

  const handleLimitChange = useCallback(
    (value: number) => {
      setLimit(value);
      resetPagination();
    },
    [resetPagination]
  );

  const previousSearch = useRef(trimmedSearch);
  useEffect(() => {
    if (previousSearch.current === trimmedSearch) {
      return;
    }
    previousSearch.current = trimmedSearch;
    resetPagination();
  }, [trimmedSearch, resetPagination]);

  const currentCursor = cursorHistory[cursorHistory.length - 1];
  const effectiveDirection = activeSort
    ? direction ?? activeSort.defaultDirection
    : undefined;

  const {
    data: followersPage,
    isLoading: isLoadingFollowers,
    error: followersError,
    mutate: mutateFollowers,
  } = useFollowers({
    integrationId: selectedIntegrationId,
    cursor: currentCursor,
    limit,
    sort: effectiveSort,
    direction: effectiveDirection,
    window: requiresWindow ? window : undefined,
    search: trimmedSearch || undefined,
  });

  const handleNext = useCallback(() => {
    if (!followersPage?.nextCursor) {
      return;
    }
    setCursorHistory((previous) => [...previous, followersPage.nextCursor!]);
    setPageNumber((previous) => previous + 1);
  }, [followersPage?.nextCursor]);

  const handlePrevious = useCallback(() => {
    if (!cursorHistory.length) {
      return;
    }
    setCursorHistory((previous) => previous.slice(0, -1));
    setPageNumber((previous) => Math.max(1, previous - 1));
  }, [cursorHistory.length]);

  const openFollowerDetail = useCallback(
    (follower: Follower) => {
      if (!selectedIntegrationId) {
        return;
      }
      modal.openModal({
        id: `follower-detail-${selectedIntegrationId}-${follower.id}`,
        title: '',
        withCloseButton: false,
        classNames: {
          modal: 'w-[100%] max-w-[720px] text-textColor',
        },
        children: (
          <FollowerDetailModal
            integrationId={selectedIntegrationId}
            externalId={follower.id}
          />
        ),
      });
    },
    [modal, selectedIntegrationId]
  );

  if (isLoadingChannels || isLoadingIntegrations) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[15px] transition-all items-center justify-center">
        <LoadingComponent />
      </div>
    );
  }

  if (channelsError) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[15px] transition-all items-center justify-center text-center">
        <p className="text-[18px] text-newTextColor">
          {t(
            'followers_channels_error',
            'We could not load follower channels right now.'
          )}
        </p>
        <Button onClick={() => mutateChannels()}>
          {t('followers_retry', 'Retry')}
        </Button>
      </div>
    );
  }

  if (!channels.length) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-col gap-[15px] transition-all flex-1 justify-center items-center text-center">
        <div>
          <img src="/peoplemarketplace.svg" alt="" />
        </div>
        <div className="text-[32px] md:text-[48px] text-newTextColor">
          {t('followers_no_channels_title', 'No follower channels yet')}
        </div>
        <div className="text-[16px] md:text-[20px] text-textItemBlur max-w-[720px]">
          {t(
            'followers_no_channels_description',
            'Connect a channel that exposes follower identities through its API. Some channels may require reconnecting after new permissions are added.'
          )}
        </div>
        <Button onClick={() => router.push('/calendar')}>
          {t(
            'go_to_the_calendar_to_add_channels',
            'Go to the calendar to add channels'
          )}
        </Button>
      </div>
    );
  }

  const showSortSelector = (selectedChannel?.sorts.length ?? 0) > 1;
  const showDirectionSelector = (activeSort?.directions.length ?? 0) > 1;
  const isPageScopedSort = activeSort?.scope === 'page';
  const canGoPrevious = cursorHistory.length > 0 && !isLoadingFollowers;
  const canGoNext = !!followersPage?.hasMore && !isLoadingFollowers;
  const tracking = followersPage?.tracking ?? selectedChannel?.tracking;
  const isTrackingProvisioning = tracking?.availability === 'provisioning';
  const isTrackingUnavailable = tracking?.availability === 'unavailable';
  const isTrackingReady = tracking?.availability === 'ready';

  const renderEmptyState = () => {
    if (trimmedSearch) {
      return (
        <div className="flex flex-col items-center justify-center gap-[8px] rounded-[12px] border border-newTableBorder bg-newTableHeader p-[32px] text-center">
          <p className="text-[18px] text-newTextColor">
            {t('followers_search_empty_title', 'No followers match this search')}
          </p>
          <p className="text-[14px] text-textItemBlur max-w-[520px]">
            {t(
              'followers_search_empty_description',
              'Try a different username or display name.'
            )}
          </p>
        </div>
      );
    }

    if (isInteractionsSort && isTrackingProvisioning) {
      return (
        <div className="flex flex-col items-center justify-center gap-[8px] rounded-[12px] border border-newTableBorder bg-newTableHeader p-[32px] text-center">
          <p className="text-[18px] text-newTextColor">
            {t(
              'followers_interactions_provisioning_title',
              'Setting up interaction tracking'
            )}
          </p>
          <p className="text-[14px] text-textItemBlur max-w-[520px]">
            {t(
              'followers_interactions_provisioning_description',
              'We are syncing followers and preparing interaction rankings for this channel. Check back shortly.'
            )}
          </p>
        </div>
      );
    }

    if (isInteractionsSort && isTrackingUnavailable) {
      return (
        <div className="flex flex-col items-center justify-center gap-[8px] rounded-[12px] border border-newTableBorder bg-newTableHeader p-[32px] text-center">
          <p className="text-[18px] text-newTextColor">
            {t(
              'followers_interactions_unavailable_title',
              'Interaction rankings unavailable'
            )}
          </p>
          <p className="text-[14px] text-textItemBlur max-w-[520px]">
            {t(
              'followers_interactions_unavailable_description',
              'We could not load interaction rankings for this channel right now.'
            )}
          </p>
          <Button onClick={() => mutateFollowers()}>
            {t('followers_retry', 'Retry')}
          </Button>
        </div>
      );
    }

    if (isInteractionsSort && isTrackingReady) {
      return (
        <div className="flex flex-col items-center justify-center gap-[8px] rounded-[12px] border border-newTableBorder bg-newTableHeader p-[32px] text-center">
          <p className="text-[18px] text-newTextColor">
            {t(
              'followers_interactions_empty_title',
              'No interactions in this time window'
            )}
          </p>
          <p className="text-[14px] text-textItemBlur max-w-[520px]">
            {t(
              'followers_interactions_empty_description',
              'No follower interactions were recorded during the selected period. Try a longer time window.'
            )}
          </p>
        </div>
      );
    }

    if (isNotesSort) {
      return (
        <div className="flex flex-col items-center justify-center gap-[8px] rounded-[12px] border border-newTableBorder bg-newTableHeader p-[32px] text-center">
          <p className="text-[18px] text-newTextColor">
            {t(
              'followers_notes_empty_title',
              'No synced followers to sort by notes yet'
            )}
          </p>
          <p className="text-[14px] text-textItemBlur max-w-[520px]">
            {t(
              'followers_notes_empty_description',
              'Once followers are synced for this channel, you can sort them by how many team notes they have.'
            )}
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center gap-[8px] rounded-[12px] border border-newTableBorder bg-newTableHeader p-[32px] text-center">
        <p className="text-[18px] text-newTextColor">
          {t('followers_empty_page', 'No followers on this page')}
        </p>
        <p className="text-[14px] text-textItemBlur max-w-[520px]">
          {t(
            'followers_reconnect_caveat',
            'If you recently connected this channel, you may need to reconnect so it can access follower data.'
          )}
        </p>
      </div>
    );
  };

  return (
    <>
      <ChannelsSidebar
        integrationCount={followerIntegrations.length}
        showAddProvider={false}
      >
        {(collapsed) => (
          <ChannelMenu
            collapsed={collapsed}
            integrations={followerIntegrations}
            selectedIds={selectedIntegrationId ? [selectedIntegrationId] : []}
            onSelect={(integration) => {
              const channel = channels.find((item) => item.id === integration.id);
              if (channel) {
                handleChannelSelect(channel);
              }
            }}
          />
        )}
      </ChannelsSidebar>

      <div className="bg-newBgColorInner flex-1 flex-col flex p-[20px] gap-[16px] min-w-0">
        <div className="flex flex-col gap-[12px] md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h2 className="text-[20px] font-[600] text-newTextColor truncate">
              {selectedChannel?.name}
            </h2>
            {selectedChannel?.display && (
              <p className="text-[14px] text-textItemBlur truncate">
                {selectedChannel.display}
              </p>
            )}
            {Number.isFinite(followersPage?.total) && (
              <p className="text-[13px] text-textItemBlur">
                {t('followers_total', '{{count}} total', {
                  count: followersPage!.total!,
                })}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-[12px]">
            <div className="min-w-[220px] flex-1">
              <Input
                label={t('followers_search', 'Search')}
                name="followers-search"
                disableForm={true}
                removeError={true}
                value={search}
                placeholder={t(
                  'followers_search_placeholder',
                  'Search by username or name'
                )}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            {showSortSelector && (
              <div className="min-w-[160px]">
                <Select
                  label={t('followers_sort_by', 'Sort by')}
                  name="followers-sort"
                  disableForm={true}
                  hideErrors={true}
                  value={sort ?? selectedChannel?.sorts[0]?.key ?? ''}
                  onChange={(event) => handleSortChange(event.target.value)}
                >
                  {selectedChannel?.sorts.map((sortOption) => (
                    <option key={sortOption.key} value={sortOption.key}>
                      {sortOption.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {requiresWindow && (
              <div className="min-w-[140px]">
                <Select
                  label={t('followers_time_window', 'Time window')}
                  name="followers-window"
                  disableForm={true}
                  hideErrors={true}
                  value={window}
                  onChange={(event) =>
                    handleWindowChange(
                      event.target.value as ChannelInteractionWindow
                    )
                  }
                >
                  {FOLLOWER_INTERACTION_WINDOWS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey, option.defaultLabel)}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {showDirectionSelector && (
              <div className="min-w-[140px]">
                <Select
                  label={t('followers_direction', 'Direction')}
                  name="followers-direction"
                  disableForm={true}
                  hideErrors={true}
                  value={direction ?? activeSort?.defaultDirection ?? 'desc'}
                  onChange={(event) =>
                    handleDirectionChange(
                      event.target.value as FollowerSortDirection
                    )
                  }
                >
                  {activeSort?.directions.map((sortDirection) => (
                    <option key={sortDirection} value={sortDirection}>
                      {sortDirection === 'asc'
                        ? t('followers_direction_asc', 'Ascending')
                        : t('followers_direction_desc', 'Descending')}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="min-w-[120px]">
              <Select
                label={t('followers_page_size', 'Per page')}
                name="followers-limit"
                disableForm={true}
                hideErrors={true}
                value={String(limit)}
                onChange={(event) => handleLimitChange(Number(event.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {isPageScopedSort && (
          <p className="text-[13px] text-textItemBlur">
            {t(
              'followers_page_sort_hint',
              'Sorting applies to the current page only. Use Recent for the channel’s native order across pages.'
            )}
          </p>
        )}

        {isInteractionsSort && (
          <TrackingNotice tracking={tracking} showFreshness={isTrackingReady} />
        )}

        {followersError && (
          <div className="flex flex-col items-center justify-center gap-[12px] rounded-[12px] border border-newTableBorder bg-newTableHeader p-[24px] text-center">
            <p className="text-[16px] text-newTextColor">
              {t(
                'followers_load_error',
                'We could not load followers for this channel right now.'
              )}
            </p>
            <Button onClick={() => mutateFollowers()}>
              {t('followers_retry', 'Retry')}
            </Button>
          </div>
        )}

        {!followersError && isLoadingFollowers && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[16px]">
            {Array.from({ length: limit > 12 ? 6 : 3 }).map((_, index) => (
              <FollowerCardSkeleton key={index} />
            ))}
          </div>
        )}

        {!followersError && !isLoadingFollowers && !followersPage?.items.length && (
          renderEmptyState()
        )}

        {!followersError && !isLoadingFollowers && !!followersPage?.items.length && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[16px]">
              {followersPage.items.map((follower) => (
                <FollowerCard
                  key={follower.id}
                  follower={follower}
                  onOpen={() => openFollowerDetail(follower)}
                />
              ))}
            </div>

            <div className="flex flex-col gap-[8px] items-center justify-center pt-[8px]">
              <div className="flex items-center gap-[12px]">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={!canGoPrevious}
                  className={clsx(
                    'inline-flex items-center gap-[6px] rounded-[8px] border border-newTableBorder px-[14px] py-[8px] text-[14px] text-newTextColor hover:bg-newTableHeader transition-colors',
                    !canGoPrevious && 'opacity-30 pointer-events-none'
                  )}
                  aria-label={t('previous', 'Previous')}
                >
                  <span>{t('previous', 'Previous')}</span>
                </button>
                <span className="text-[14px] text-textItemBlur">
                  {t('followers_page', 'Page {{number}}', {
                    number: pageNumber,
                  })}
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canGoNext}
                  className={clsx(
                    'inline-flex items-center gap-[6px] rounded-[8px] border border-newTableBorder px-[14px] py-[8px] text-[14px] text-newTextColor hover:bg-newTableHeader transition-colors',
                    !canGoNext && 'opacity-30 pointer-events-none'
                  )}
                  aria-label={t('next', 'Next')}
                >
                  <span>{t('next', 'Next')}</span>
                </button>
              </div>
              {!followersPage.hasMore && (
                <p className="text-[13px] text-textItemBlur">
                  {t('followers_end_of_list', 'End of list')}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
};
