'use client';

import { useCallback } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { setCookie } from '@gitroom/frontend/components/layout/layout.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Button } from '@gitroom/react/form/button';
import useSWR from 'swr';

export const useStopImpersonating = () => {
  const fetch = useFetch();
  const { isSecured } = useVariables();

  return useCallback(async () => {
    if (!isSecured) {
      setCookie('impersonate', '', -10);
    } else {
      await fetch(`/user/impersonate`, {
        method: 'POST',
        body: JSON.stringify({
          id: '',
        }),
      });
    }
    window.location.reload();
  }, [fetch, isSecured]);
};

export const ImpersonationBanner = () => {
  const user = useUser();
  const t = useT();
  const fetch = useFetch();
  const stopImpersonating = useStopImpersonating();
  const load = useCallback(async () => {
    return await (await fetch('/user/organizations')).json();
  }, [fetch]);
  const { data } = useSWR('organizations', load, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
    revalidateOnReconnect: false,
  });

  if (!user?.impersonate) {
    return null;
  }

  const orgName = data?.find((d: { id: string }) => d.id === user?.orgId)?.name;
  const displayName = user.name || user.email;

  return (
    <div className="bg-forth text-white rounded-[8px] px-[16px] py-[8px] flex items-center justify-center gap-[12px] text-[14px]">
      <span>
        {t('currently_impersonating', 'Currently impersonating')}{' '}
        <span className="font-[600]">{displayName}</span>
        {orgName ? ` (${orgName})` : ''}
      </span>
      <Button
        onClick={stopImpersonating}
        className="!bg-red-500 rounded-[4px] !h-[28px] !px-[10px] text-[12px]"
      >
        {t('stop', 'Stop')}
      </Button>
    </div>
  );
};
