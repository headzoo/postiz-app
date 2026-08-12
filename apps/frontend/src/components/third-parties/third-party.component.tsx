'use client';

import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { ThirdPartyListComponent } from '@gitroom/frontend/components/third-parties/third-party.list.component';
import React, { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { Button } from '@gitroom/react/form/button';

export const ThirdPartyComponent = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();

  const integrations = useCallback(async () => {
    return (await fetch('/third-party')).json();
  }, []);

  const { data, isLoading, mutate } = useSWR('third-party', integrations, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });

  const deleteChannel = useCallback(
    (id: string) => async () => {
      if (
        !(await deleteDialog(
          t(
            'are_you_sure_you_want_to_delete_this_integration',
            'Are you sure you want to delete this integration?'
          )
        ))
      ) {
        return;
      }

      const res = await fetch(`/third-party/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toaster.show('Integration deleted successfully', 'success');
        mutate();
      } else {
        const error = await res.json();
        console.error('Error deleting integration:', error);
      }
    },
    [fetch, mutate, t, toaster]
  );

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="flex flex-col">
        <h3 className="text-[20px]">{t('integrations', 'Integrations')}</h3>
        <div className="text-customColor18 mt-[4px]">
          {t(
            'connect_third_party_services',
            'Connect third-party services to use them in Postiz.'
          )}
        </div>
      </div>

      <div className="bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[16px]">
        {!isLoading && !data?.length ? (
          <div className="text-customColor18">
            {t('no_integrations_yet', 'No Integrations Yet')}
          </div>
        ) : (
          data?.map((p: any) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-[12px] border border-fifth rounded-[4px]"
            >
              <div className="flex items-center gap-[12px]">
                <ImageWithFallback
                  fallbackSrc={`/icons/third-party/${p.identifier}.png`}
                  src={`/icons/third-party/${p.identifier}.png`}
                  className="rounded-full"
                  alt={p.title}
                  width={40}
                  height={40}
                />
                <div className="text-[14px] font-bold">{p.name}</div>
              </div>
              <Button onClick={deleteChannel(p.id)}>
                {t('delete_integration', 'Delete Integration')}
              </Button>
            </div>
          ))
        )}
      </div>

      <ThirdPartyListComponent reload={mutate} />
    </div>
  );
};
