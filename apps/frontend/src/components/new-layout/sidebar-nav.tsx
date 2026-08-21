'use client';

import { FC } from 'react';
import { Logo } from '@gitroom/frontend/components/new-layout/logo';
import { TopMenu } from '@gitroom/frontend/components/layout/top.menu';

export const SidebarNav: FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  return (
    <div className="flex flex-col items-center h-full gap-[32px] flex-1 py-[12px]">
      <Logo sidebar />
      <TopMenu onNavigate={onNavigate} />
    </div>
  );
};
