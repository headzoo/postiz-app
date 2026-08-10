'use client';

import { useCallback, useMemo, useState } from 'react';
import clsx from 'clsx';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import {
  ChannelMenu,
  ChannelsSidebar,
} from '@gitroom/frontend/components/launches/channels.sidebar';
import {
  IntegrationListItem,
  useIntegrationList,
} from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import { DNDProvider } from '@gitroom/frontend/components/launches/helpers/dnd.provider';
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
  const {
    data: integrations,
    isLoading: integrationsLoading,
    mutate: mutateIntegrations,
  } = useIntegrationList();
  const {
    data: channels,
    isLoading: analyticsLoading,
  } = useDashboardAnalytics(date);

  const channelsById = useMemo(
    () => new Map(channels?.map((channel) => [channel.id, channel])),
    [channels]
  );

  const successfulChannels = channels?.filter((channel) => channel.state === 'ok') || [];
  const allUnsupported =
    !!channels?.length && channels.every((channel) => channel.state === 'unsupported');
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

  if (integrationsLoading || analyticsLoading) {
    return (
      <div className="bg-newBgColorInner flex flex-1 items-center justify-center">
        <LoadingComponent />
      </div>
    );
  }

  return (
    <DNDProvider>
      <ChannelsSidebar
        integrationCount={integrations.length}
        onUpdate={() => void mutateIntegrations()}
      >
        {(collapsed) => (
          <div className="flex flex-col gap-[32px]">
            <ChannelMenu
              collapsed={collapsed}
              integrations={integrations}
              mutate={() => void mutateIntegrations()}
              onUpdate={() => void mutateIntegrations()}
              onGroupChange={(id, group) => void changeItemGroup(id, group)}
              onRefreshChannel={refreshChannel}
              onContinueIntegration={continueIntegration}
            />
          </div>
        )}
      </ChannelsSidebar>
      <main className="bg-newBgColorInner flex-1 overflow-y-auto p-[20px]">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-[24px]">
          <div className="flex flex-wrap items-center justify-between gap-[12px]">
            <div>
              <h2 className="text-[20px] font-[600]">Channel analytics</h2>
              <p className="mt-[4px] text-[14px] text-newTableText">
                Analytics available for each connected channel.
              </p>
            </div>
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
          </div>

          {integrations.length === 0 && (
            <div className="rounded-[12px] border border-newTableBorder bg-newTableHeader px-[24px] py-[48px] text-center">
              <h3 className="text-[18px] font-[600]">No channels yet</h3>
              <p className="mt-[8px] text-[14px] text-newTableText">
                Add a provider from the Channels sidebar to see analytics here.
              </p>
            </div>
          )}

          {allUnsupported && (
            <div className="rounded-[12px] border border-newTableBorder bg-newTableHeader px-[24px] py-[32px] text-[14px] text-newTableText">
              Analytics are not supported by any of your connected channels.
            </div>
          )}

          {successfulChannels.length > 0 && successfulChannels.length < (channels?.length || 0) && (
            <div className="rounded-[8px] bg-btnSimple px-[14px] py-[10px] text-[14px] text-newTableText">
              Some channel analytics could not be displayed. See each channel for details.
            </div>
          )}

          {channels?.map((channel) => (
            <section key={channel.id} className="flex flex-col gap-[14px]">
              <div className="flex items-center gap-[10px]">
                <ImageWithFallback
                  fallbackSrc="/no-picture.jpg"
                  src={channel.picture || '/no-picture.jpg'}
                  className="rounded-[8px]"
                  alt={channel.identifier}
                  width={36}
                  height={36}
                />
                <div>
                  <h3 className="font-[600]">{channel.name}</h3>
                  <p className="text-[13px] text-newTableText">{channel.identifier}</p>
                </div>
              </div>
              {channel.state === 'ok' ? (
                channel.analytics.length ? (
                  <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 xl:grid-cols-3">
                    {channel.analytics.map((metric, index) => (
                      <AnalyticsCard
                        key={`${channel.id}-${metric.label}`}
                        item={metric}
                        total={analyticsTotal(metric)}
                        index={index}
                      />
                    ))}
                  </div>
                ) : (
                  <ChannelState channel={channel} empty />
                )
              ) : (
                <ChannelState channel={channel} />
              )}
            </section>
          ))}
        </div>
      </main>
    </DNDProvider>
  );
};
