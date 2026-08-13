'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { PlugsContext } from '@gitroom/frontend/components/plugs/plugs.context';
import { Plug } from '@gitroom/frontend/components/plugs/plug';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { Button } from '@gitroom/react/form/button';
import { filterPlugCapableChannels } from '@gitroom/frontend/components/plugs/plug.utils';
import { useProviderPlugList } from '@gitroom/frontend/components/plugs/use.provider.plug.list';
import { Integrations } from '@gitroom/frontend/components/launches/calendar.context';
import {
  ChannelMenu,
  ChannelsSidebar,
  groupChannelsByCustomer,
} from '@gitroom/frontend/components/launches/channels.sidebar';
import {
  resolveChannelId,
  setLastChannelId,
} from '@gitroom/frontend/components/launches/helpers/last-channel';
import {
  IntegrationListItem,
  useIntegrationList,
} from '@gitroom/frontend/components/launches/helpers/use.integration.list';

export const Plugs = () => {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>();
  const [refresh, setRefresh] = useState(false);
  const toaster = useToaster();
  const { data: plugList, isLoading: plugLoading } = useProviderPlugList();
  const { data: integrations = [], isLoading } = useIntegrationList();

  const t = useT();

  const plugIntegrations = useMemo(
    () =>
      filterPlugCapableChannels(
        integrations as Integrations[],
        plugList?.plugs || []
      ) as IntegrationListItem[],
    [integrations, plugList?.plugs]
  );
  const groupedIntegrations = useMemo(
    () => groupChannelsByCustomer(plugIntegrations),
    [plugIntegrations]
  );

  useEffect(() => {
    const nextId = resolveChannelId({
      eligibleIds: plugIntegrations.map((integration) => integration.id),
      currentId: selectedId,
      fallbackId: groupedIntegrations[0]?.values[0]?.id,
    });
    if (nextId === selectedId) {
      return;
    }
    setSelectedId(nextId);
  }, [groupedIntegrations, plugIntegrations, selectedId]);

  const currentIntegration = useMemo(
    () => plugIntegrations.find((integration) => integration.id === selectedId),
    [plugIntegrations, selectedId]
  );
  const currentIntegrationPlug = useMemo(() => {
    if (!currentIntegration) {
      return null;
    }
    const plug = plugList?.plugs?.find(
      (entry) => entry?.identifier === currentIntegration?.identifier
    );
    if (!plug) {
      return null;
    }
    return {
      providerId: currentIntegration.id,
      name: currentIntegration.name,
      identifier: currentIntegration.identifier,
      plugs: plug.plugs,
    };
  }, [currentIntegration, plugList]);

  const handleSelect = (integration: IntegrationListItem) => {
    if (integration.refreshNeeded) {
      toaster.show(
        'Please refresh the integration from the calendar',
        'warning'
      );
      return;
    }
    setRefresh(true);
    setTimeout(() => {
      setRefresh(false);
    }, 10);
    setLastChannelId(integration.id);
    setSelectedId(integration.id);
  };

  if (isLoading || plugLoading) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[15px] transition-all items-center justify-center">
        <LoadingComponent />
      </div>
    );
  }

  if (!plugIntegrations.length && !isLoading) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[15px] transition-all items-center justify-center">
        <div>
          <img src="/peoplemarketplace.svg" />
        </div>
        <div className="text-[48px]">
          {t(
            'there_are_not_plugs_matching_your_channels',
            'There are not plugs matching your channels'
          )}
          <br />
          {t(
            'you_have_to_add_x_linkedin_page_threads_or_bluesky',
            'You have to add: X, LinkedIn Page, Threads or Bluesky'
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
  return (
    <>
      <ChannelsSidebar
        integrationCount={plugIntegrations.length}
        showAddProvider={false}
      >
        {(collapsed) => (
          <ChannelMenu
            collapsed={collapsed}
            integrations={plugIntegrations}
            selectedIds={selectedId ? [selectedId] : []}
            onSelect={handleSelect}
          />
        )}
      </ChannelsSidebar>
      <div className="bg-newBgColorInner flex-1 flex-col flex p-[20px] gap-[12px]">
        {currentIntegrationPlug && !refresh && (
          <PlugsContext.Provider value={currentIntegrationPlug}>
            <Plug />
          </PlugsContext.Provider>
        )}
      </div>
    </>
  );
};
