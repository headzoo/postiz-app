'use client';

import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import useCookie from 'react-use-cookie';
import { useRouter } from 'next/navigation';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Button } from '@gitroom/react/form/button';
import { Select } from '@gitroom/react/form/select';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { SVGLine } from '@gitroom/frontend/components/launches/launches.component';
import { FollowerCard } from '@gitroom/frontend/components/followers/follower.card';
import {
  FollowerChannel,
  FollowerSortDirection,
  useFollowerChannels,
  useFollowers,
} from '@gitroom/frontend/components/followers/use.followers';

const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;

const FollowerCardSkeleton: FC = () => (
  <div
    className={clsx(
      'h-[220px] rounded-[12px] border border-newTableBorder bg-newTableHeader',
      'animate-pulse'
    )}
  />
);

export const FollowersComponent: FC = () => {
  const t = useT();
  const router = useRouter();
  const [collapseMenu, setCollapseMenu] = useCookie('collapseMenu', '0');
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>();
  const [sort, setSort] = useState<string>();
  const [direction, setDirection] = useState<FollowerSortDirection>();
  const [limit, setLimit] = useState<number>(24);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [pageNumber, setPageNumber] = useState(1);

  const {
    data: channels = [],
    isLoading: isLoadingChannels,
    error: channelsError,
    mutate: mutateChannels,
  } = useFollowerChannels();

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

    const firstChannel = channels[0];
    setSelectedIntegrationId(firstChannel.id);
    const defaultSort = firstChannel.sorts[0];
    setSort(defaultSort?.key);
    setDirection(defaultSort?.defaultDirection);
    setCursorHistory([]);
    setPageNumber(1);
  }, [channels, selectedIntegrationId]);

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedIntegrationId),
    [channels, selectedIntegrationId]
  );

  const effectiveSort = sort ?? selectedChannel?.sorts[0]?.key;

  const activeSort = useMemo(
    () => selectedChannel?.sorts.find((item) => item.key === effectiveSort),
    [selectedChannel, effectiveSort]
  );

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

  const handleLimitChange = useCallback(
    (value: number) => {
      setLimit(value);
      resetPagination();
    },
    [resetPagination]
  );

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

  if (isLoadingChannels) {
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

  return (
    <>
      <div
        className={clsx(
          'bg-newBgColorInner p-[20px] flex flex-col gap-[15px] transition-all',
          collapseMenu === '1' ? 'group sidebar w-[100px]' : 'w-[260px]'
        )}
      >
        <div className="flex gap-[12px] flex-col">
          <div className="flex items-center">
            <h2 className="group-[.sidebar]:hidden flex-1 text-[20px] font-[500] text-newTextColor">
              {t('channels', 'Channels')}
            </h2>
            <button
              type="button"
              onClick={() => setCollapseMenu(collapseMenu === '1' ? '0' : '1')}
              className="group-[.sidebar]:rotate-[180deg] group-[.sidebar]:mx-auto text-btnText bg-btnSimple rounded-[6px] w-[24px] h-[24px] flex items-center justify-center cursor-pointer select-none"
              aria-label={t('followers_toggle_channels', 'Toggle channels sidebar')}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="7"
                height="13"
                viewBox="0 0 7 13"
                fill="none"
              >
                <path
                  d="M6 11.5L1 6.5L6 1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          {channels.map((channel) => (
            <button
              type="button"
              key={channel.id}
              onClick={() => handleChannelSelect(channel)}
              className={clsx(
                'flex gap-[12px] items-center group/profile justify-center hover:bg-boxHover rounded-e-[8px] text-start',
                selectedChannel?.id !== channel.id &&
                'opacity-20 hover:opacity-100 cursor-pointer'
              )}
            >
              <div className="relative rounded-full flex justify-center items-center gap-[6px]">
                <div className="h-full w-[4px] -ms-[12px] rounded-s-[3px] opacity-0 group-hover/profile:opacity-100 transition-opacity">
                  <SVGLine />
                </div>
                <ImageWithFallback
                  fallbackSrc={`/icons/platforms/${channel.identifier}.png`}
                  src={channel.picture || '/no-picture.jpg'}
                  className="rounded-[8px]"
                  alt={channel.name}
                  width={36}
                  height={36}
                />
                <SafeImage
                  src={`/icons/platforms/${channel.identifier}.png`}
                  className="rounded-[8px] absolute z-10 bottom-[5px] -end-[5px] border border-fifth"
                  alt={channel.identifier}
                  width={18.41}
                  height={18.41}
                />
              </div>
              <div className="flex-1 min-w-0 whitespace-nowrap text-ellipsis overflow-hidden group-[.sidebar]:hidden text-newTextColor">
                {channel.name}
              </div>
            </button>
          ))}
        </div>
      </div>

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
        )}

        {!followersError && !isLoadingFollowers && !!followersPage?.items.length && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[16px]">
              {followersPage.items.map((follower) => (
                <FollowerCard key={follower.id} follower={follower} />
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
