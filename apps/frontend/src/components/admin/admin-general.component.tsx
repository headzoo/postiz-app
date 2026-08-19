'use client';

import { useCallback } from 'react';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { Button } from '@gitroom/react/form/button';
import { ImportDebugPostModal } from '@gitroom/frontend/components/launches/import-debug-post.modal';
import { AddAnnouncement } from '@gitroom/frontend/components/admin/admin-announcement.modal';
import {
  ManageBilling,
  Subscription,
} from '@gitroom/frontend/components/admin/admin-billing.modals';
import { AddTeamMember } from '@gitroom/frontend/components/admin/admin-team-member.modal';
import { SwitchUser } from '@gitroom/frontend/components/admin/admin-switch-user';
import { useStopImpersonating } from '@gitroom/frontend/components/layout/impersonation-banner.component';

const ImportDebugPost = () => {
  const { openModal } = useModals();
  const t = useT();

  const handleClick = useCallback(() => {
    openModal({
      title: t('import_debug_post', 'Import Debug Post'),
      maxSize: 800,
      children: (close) => <ImportDebugPostModal close={close} />,
    });
  }, []);

  return (
    <Button onClick={handleClick} className="!bg-yellow-600 rounded-[4px]">
      {t('import_debug_post', 'Import Debug Post')}
    </Button>
  );
};

export const AdminGeneralComponent = () => {
  const user = useUser();
  const { billingEnabled } = useVariables();
  const t = useT();
  const stopImpersonating = useStopImpersonating();

  return (
    <div className="flex flex-col gap-[24px] text-textColor">
      <div className="text-[20px] font-[600]">
        {t('admin_general', 'General')}
      </div>

      <div className="flex flex-col gap-[12px]">
        <div className="text-[16px] font-[600]">
          {t('admin_tools', 'Admin tools')}
        </div>
        <div className="flex flex-wrap gap-[12px]">
          <ImportDebugPost />
          <AddAnnouncement />
        </div>
      </div>

      {user?.impersonate && (
        <div className="flex flex-col gap-[12px]">
          <div className="text-[16px] font-[600]">
            {t('impersonation_session', 'Impersonation session')}
          </div>
          <div className="flex flex-wrap items-center gap-[12px]">
            <Button
              onClick={stopImpersonating}
              className="!bg-red-500 rounded-[4px]"
            >
              {t('stop_impersonating', 'Stop impersonating')}
            </Button>
            {user?.tier?.current === 'FREE' && <Subscription />}
            {user?.tier?.team_members && <AddTeamMember />}
            {billingEnabled && <ManageBilling />}
          </div>
          <SwitchUser />
        </div>
      )}
    </div>
  );
};
