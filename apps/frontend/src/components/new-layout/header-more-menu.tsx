'use client';

import { FC, useState } from 'react';
import { useClickAway } from '@uidotdev/usehooks';
import clsx from 'clsx';
import { MoreIcon } from '@gitroom/frontend/components/ui/icons';
import { OrganizationSelector } from '@gitroom/frontend/components/layout/organization.selector';
import { ChromeExtensionComponent } from '@gitroom/frontend/components/layout/chrome.extension.component';
import { AttachToFeedbackIcon } from '@gitroom/frontend/components/new-layout/sentry.feedback.component';

export const HeaderMoreMenu: FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useClickAway<HTMLDivElement>(() => setOpen(false));

  return (
    <div className="relative hidden mobile:flex" ref={ref}>
      <button
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="text-textItemBlur hover:text-newTextColor p-[4px]"
      >
        <MoreIcon size={22} />
      </button>
      <div
        className={clsx(
          'absolute top-[100%] end-0 mt-[8px] min-w-[200px] bg-third border border-tableBorder rounded-[12px] p-[12px] flex flex-col gap-[12px] z-[600]',
          open ? 'flex' : 'hidden'
        )}
      >
        <OrganizationSelector asOpenSelect />
        <div className="flex items-center gap-[16px] text-textItemBlur">
          <ChromeExtensionComponent />
          <AttachToFeedbackIcon />
        </div>
      </div>
    </div>
  );
};
