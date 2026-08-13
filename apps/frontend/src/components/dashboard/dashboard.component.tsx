'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import {
  ChannelMenu,
  ChannelsSidebar,
  groupChannelsByCustomer,
} from '@gitroom/frontend/components/launches/channels.sidebar';
import {
  IntegrationListItem,
  useIntegrationList,
} from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import { useIntegrationNoticeStatus } from '@gitroom/frontend/components/launches/helpers/use.integration.notice.status';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useRouter } from 'next/navigation';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import {
  AnalyticsCard,
  analyticsTotal,
} from '@gitroom/frontend/components/platform-analytics/render.analytics';
import {
  DashboardChannelAnalytics,
  useDashboardAnalytics,
} from './use.dashboard.analytics';

const dateOptions: Array<7 | 30 | 90> = [7, 30, 90];

const ChannelState = ({
  channel,
  empty,
}: {
  channel: DashboardChannelAnalytics;
  empty?: boolean;
}) => {
  const message = empty
    ? 'No analytics data for this period'
    : channel.state === 'unsupported'
      ? 'Analytics not supported'
      : channel.state === 'unavailable'
        ? 'Reconnect or refresh this channel to view analytics'
        : channel.state === 'disabled'
          ? 'Channel disabled'
          : null;

  if (!message) {
    return null;
  }

  return (
    <div className="rounded-[12px] border border-newTableBorder bg-newTableHeader px-[20px] py-[24px] text-[14px] text-newTableText">
      {message}
    </div>
  );
};

export const Dashboard = () => {
  const fetch = useFetch();
  const router = useRouter();
  const [date, setDate] = useState<7 | 30 | 90>(7);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>();
  const {
    data: integrations,
    isLoading: integrationsLoading,
    mutate: mutateIntegrations,
  } = useIntegrationList();
  const {
    data: noticeStatus,
    mutate: mutateNoticeStatus,
  } = useIntegrationNoticeStatus();
  const groupedIntegrations = useMemo(
    () => groupChannelsByCustomer(integrations),
    [integrations]
  );

  useEffect(() => {
    if (!integrations.length) {
      setSelectedIntegrationId(undefined);
      return;
    }

    if (
      selectedIntegrationId &&
      integrations.some((integration) => integration.id === selectedIntegrationId)
    ) {
      return;
    }

    setSelectedIntegrationId(groupedIntegrations[0]?.values[0]?.id);
  }, [groupedIntegrations, integrations, selectedIntegrationId]);

  const {
    data: channels,
    isLoading: analyticsLoading,
  } = useDashboardAnalytics(date, selectedIntegrationId);
  const selectedChannel = channels?.[0];
  const selectedIntegration = integrations.find(
    (integration) => integration.id === selectedIntegrationId
  );

  const changeItemGroup = useCallback(
    async (id: string, group: string) => {
      await mutateIntegrations(
        integrations.map((integration) =>
          integration.id === id
            ? { ...integration, customer: { id: group } }
            : integration
        ),
        false
      );
      await fetch(`/integrations/${id}/group`, {
        method: 'PUT',
        body: JSON.stringify({ group }),
      });
      await mutateIntegrations();
    },
    [fetch, integrations, mutateIntegrations]
  );
  const refreshChannel = useCallback(
    (integration: IntegrationListItem) => async () => {
      const { url } = await (
        await fetch(
          `/integrations/social/${integration.identifier}?refresh=${integration.internalId}`,
          { method: 'GET' }
        )
      ).json();
      window.location.href = url;
    },
    [fetch]
  );
  const continueIntegration = useCallback(
    (integration: IntegrationListItem) => () => {
      router.push(`/calendar?added=${integration.identifier}&continue=${integration.id}`);
    },
    [router]
  );
  const clearNotices = useCallback(
    (integrationId: string) => {
      void mutateNoticeStatus(
        (current) => {
          const statuses = { ...(current?.statuses || {}) };
          const existing = statuses[integrationId];
          if (existing) {
            statuses[integrationId] = {
              ...existing,
              unreadCount: 0,
              categories: undefined,
            };
          }
          return { statuses };
        },
        { revalidate: false }
      );
      void fetch(`/integrations/${integrationId}/notices/read`, {
        method: 'POST',
      });
    },
    [fetch, mutateNoticeStatus]
  );

  if (integrationsLoading) {
    return (
      <div className="bg-newBgColorInner flex flex-1 items-center justify-center">
        <LoadingComponent />
      </div>
    );
  }

  return (
    <>
      <ChannelsSidebar
        integrationCount={integrations.length}
        onUpdate={() => void mutateIntegrations()}
      >
        {(collapsed) => (
          <div className="flex flex-col gap-[32px]">
            <ChannelMenu
              collapsed={collapsed}
              integrations={integrations}
              selectedIds={selectedIntegrationId ? [selectedIntegrationId] : []}
              onSelect={(integration) =>
                setSelectedIntegrationId(integration.id)
              }
              mutate={() => void mutateIntegrations()}
              onUpdate={() => void mutateIntegrations()}
              onGroupChange={(id, group) => void changeItemGroup(id, group)}
              onRefreshChannel={refreshChannel}
              onContinueIntegration={continueIntegration}
              noticeStatuses={noticeStatus?.statuses}
              onClearNotices={clearNotices}
            />
          </div>
        )}
      </ChannelsSidebar>
      <main className="bg-newBgColorInner flex-1 overflow-y-auto p-[20px]">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-[24px]">
          <div className="flex flex-wrap items-center justify-between gap-[12px]">
            <div className="min-w-0">
              <div className="flex items-center gap-[10px]">
                {selectedIntegration && (
                  <ImageWithFallback
                    fallbackSrc="/no-picture.jpg"
                    src={selectedIntegration.picture || '/no-picture.jpg'}
                    className="rounded-[8px]"
                    alt={selectedIntegration.identifier}
                    width={36}
                    height={36}
                  />
                )}
                <div className="min-w-0">
                  <h2 className="text-[20px] font-[600] truncate">
                    {selectedIntegration?.name || 'Channel analytics'}
                  </h2>
                  {selectedIntegration && (
                    <p className="text-[13px] text-newTableText truncate">
                      {selectedIntegration.display || selectedIntegration.identifier}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {!!selectedIntegration && (
              <div className="flex rounded-[8px] bg-btnSimple p-[4px]">
                {dateOptions.map((option) => (
                  <button
                    key={option}
                    className={clsx(
                      'rounded-[6px] px-[12px] py-[6px] text-[13px]',
                      date === option && 'bg-newBgColorInner shadow-sm'
                    )}
                    onClick={() => setDate(option)}
                  >
                    {option} days
                  </button>
                ))}
              </div>
            )}
          </div>

          {integrations.length === 0 && (
            <div className="rounded-[12px] border border-newTableBorder bg-newTableHeader px-[24px] py-[48px] text-center">
              <h3 className="text-[18px] font-[600]">No channels yet</h3>
              <p className="mt-[8px] text-[14px] text-newTableText">
                Add a provider from the Channels sidebar to see analytics here.
              </p>
            </div>
          )}

          {!!selectedIntegration && analyticsLoading && (
            <div className="flex flex-1 items-center justify-center py-[48px]">
              <LoadingComponent />
            </div>
          )}

          {!!selectedChannel && !analyticsLoading && (
            <section className="flex flex-col gap-[14px]">
              {selectedChannel.state === 'ok' ? (
                selectedChannel.analytics.length ? (
                  <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 xl:grid-cols-3">
                    {selectedChannel.analytics.map((metric, index) => (
                      <AnalyticsCard
                        key={`${selectedChannel.id}-${metric.label}`}
                        item={metric}
                        total={analyticsTotal(metric)}
                        index={index}
                      />
                    ))}
                  </div>
                ) : (
                  <ChannelState channel={selectedChannel} empty />
                )
              ) : (
                <ChannelState channel={selectedChannel} />
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
};
