'use client';

import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Integrations } from '@gitroom/frontend/components/launches/calendar.context';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { PlugGrid } from '@gitroom/frontend/components/plugs/plug';
import {
  buildPlugInterface,
  filterPlugCapableChannels,
} from '@gitroom/frontend/components/plugs/plug.utils';
import { useProviderPlugList } from '@gitroom/frontend/components/plugs/use.provider.plug.list';
import {
  usePipelinePlugMutations,
  usePipelinePlugs,
} from '@gitroom/frontend/components/pipelines/use.pipeline.plugs';

export const PipelinePlugsPanel: FC<{
  pipelineId: string;
  channels: Integrations[];
}> = ({ pipelineId, channels }) => {
  const t = useT();
  const toaster = useToaster();
  const {
    data: plugList,
    isLoading: plugListLoading,
    error: plugListError,
    mutate: mutatePlugList,
  } = useProviderPlugList();

  const eligibleChannels = useMemo(
    () => filterPlugCapableChannels(channels, plugList?.plugs || []),
    [channels, plugList?.plugs]
  );

  const [selectedIntegrationId, setSelectedIntegrationId] = useState('');

  useEffect(() => {
    if (!eligibleChannels.length) {
      setSelectedIntegrationId('');
      return;
    }
    const stillValid = eligibleChannels.some(
      (channel) => channel.id === selectedIntegrationId
    );
    if (!stillValid) {
      setSelectedIntegrationId(eligibleChannels[0].id);
    }
  }, [eligibleChannels, selectedIntegrationId]);

  const selectedChannel = useMemo(
    () =>
      eligibleChannels.find((channel) => channel.id === selectedIntegrationId),
    [eligibleChannels, selectedIntegrationId]
  );

  const plugInterface = useMemo(() => {
    if (!selectedChannel) {
      return null;
    }
    return buildPlugInterface(selectedChannel, plugList?.plugs || []);
  }, [plugList?.plugs, selectedChannel]);

  const {
    data: savedPlugs,
    isLoading: plugsLoading,
    error: plugsError,
    mutate: mutatePlugs,
  } = usePipelinePlugs(pipelineId, selectedIntegrationId);

  const { savePlug, activatePlug, revalidate } = usePipelinePlugMutations(
    pipelineId,
    selectedIntegrationId
  );

  const selectChannel = useCallback(
    (channel: Integrations & { refreshNeeded?: boolean }) => {
      if (channel.refreshNeeded) {
        toaster.show(
          t(
            'refresh_integration_from_calendar',
            'Please refresh the integration from the calendar'
          ),
          'warning'
        );
        return;
      }
      setSelectedIntegrationId(channel.id);
    },
    [t, toaster]
  );

  const retry = useCallback(() => {
    mutatePlugList();
    mutatePlugs();
  }, [mutatePlugList, mutatePlugs]);

  const isChannelDisabled =
    selectedChannel?.disabled ||
    (selectedChannel as Integrations & { refreshNeeded?: boolean })
      ?.refreshNeeded ||
    (selectedChannel as Integrations & { inBetweenSteps?: boolean })
      ?.inBetweenSteps;

  if (plugListLoading) {
    return (
      <div className="rounded-[12px] border border-newBorder bg-newBgColor p-[20px] flex items-center justify-center min-h-[160px]">
        <LoadingComponent />
      </div>
    );
  }

  if (plugListError) {
    return (
      <div className="rounded-[12px] border border-newBorder bg-newBgColor p-[20px] flex flex-col gap-[12px]">
        <div className="text-[16px] font-[600]">
          {t('pipeline_plugs', 'Pipeline plugs')}
        </div>
        <div className="rounded-[8px] border border-red-500/30 px-[12px] py-[8px] text-[13px] text-red-500">
          {t('failed_to_load_plugs', 'Failed to load plug definitions.')}
        </div>
        <Button type="button" onClick={retry}>
          {t('retry', 'Retry')}
        </Button>
      </div>
    );
  }

  if (!eligibleChannels.length) {
    return (
      <div className="rounded-[12px] border border-newBorder bg-newBgColor p-[20px] flex flex-col gap-[12px]">
        <div className="text-[16px] font-[600]">
          {t('pipeline_plugs', 'Pipeline plugs')}
        </div>
        <div className="text-[14px] text-newTableText">
          {t(
            'pipeline_no_plug_capable_channels',
            'None of the channels in this Pipeline support plugs. Add a channel such as X, LinkedIn Page, Threads, or Bluesky to configure Pipeline-specific plugs.'
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-newBorder bg-newBgColor overflow-hidden">
      <div className="border-b border-newBorder px-[20px] py-[14px]">
        <div className="text-[16px] font-[600]">
          {t('pipeline_plugs', 'Pipeline plugs')}
        </div>
        <div className="text-[13px] text-newTableText mt-[4px]">
          {t(
            'pipeline_plugs_description',
            'Configure plugs for posts published through this Pipeline. These settings replace channel plugs for Pipeline posts.'
          )}
        </div>
      </div>

      <div className="p-[16px] flex flex-col gap-[16px]">
        <div className="flex flex-wrap gap-[8px]">
          {eligibleChannels.map((channel) => {
            const isSelected = channel.id === selectedIntegrationId;
            const channelNeedsRefresh = (
              channel as Integrations & { refreshNeeded?: boolean }
            ).refreshNeeded;
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => selectChannel(channel)}
                className={clsx(
                  'flex items-center gap-[8px] rounded-[8px] border px-[10px] py-[6px] transition-colors',
                  isSelected
                    ? 'border-newTableText bg-newTableHeader'
                    : 'border-newBorder bg-newBgColorInner hover:bg-newTableHeader',
                  channel.disabled && 'opacity-50'
                )}
                aria-pressed={isSelected}
                title={channel.name}
              >
                <div className="relative flex items-center">
                  {(channel.inBetweenSteps || channelNeedsRefresh) && (
                    <div className="absolute -start-[4px] -top-[4px] z-[1] bg-red-500 w-[12px] h-[12px] rounded-full text-[8px] flex items-center justify-center text-white">
                      !
                    </div>
                  )}
                  <ImageWithFallback
                    fallbackSrc={`/icons/platforms/${channel.identifier}.png`}
                    src={channel.picture}
                    className="rounded-[6px]"
                    alt={channel.identifier}
                    width={24}
                    height={24}
                  />
                  <SafeImage
                    src={`/icons/platforms/${channel.identifier}.png`}
                    className="rounded-[4px] absolute z-[1] bottom-[0px] -end-[4px] border border-newBorder"
                    alt={channel.identifier}
                    width={12}
                    height={12}
                  />
                </div>
                <span className="text-[12px] text-textColor truncate max-w-[140px]">
                  {channel.name}
                </span>
              </button>
            );
          })}
        </div>

        {plugsError && (
          <div className="rounded-[8px] border border-red-500/30 px-[12px] py-[8px] text-[13px] text-red-500 flex flex-col gap-[8px]">
            <span>
              {t('failed_to_load_pipeline_plugs', 'Failed to load Pipeline plugs.')}
            </span>
            <Button type="button" onClick={retry}>
              {t('retry', 'Retry')}
            </Button>
          </div>
        )}

        {plugInterface && (
          <PlugGrid
            plugs={plugInterface.plugs}
            savedPlugs={savedPlugs}
            isLoading={plugsLoading}
            onSave={savePlug}
            onActivate={activatePlug}
            onRevalidate={revalidate}
            disabled={isChannelDisabled}
          />
        )}
      </div>
    </div>
  );
};
