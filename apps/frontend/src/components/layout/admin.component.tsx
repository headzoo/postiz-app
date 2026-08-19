'use client';

import { FC, ReactNode, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { SVGLine } from '@gitroom/frontend/components/launches/launches.component';
import { AdminGeneralComponent } from '@gitroom/frontend/components/admin/admin-general.component';
import { AdminUsersComponent } from '@gitroom/frontend/components/admin/admin-users.component';
import { AdminErrorsComponent } from '@gitroom/frontend/components/admin/admin-errors.component';
import { AdminStatsComponent } from '@gitroom/frontend/components/admin/admin-stats.component';

const AdminGuard: FC<{ children: ReactNode }> = ({ children }) => {
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    if (user && !user.admin) {
      router.replace('/calendar');
    }
  }, [user, router]);

  if (!user?.admin) {
    return (
      <div className="bg-newBgColorInner flex-1 flex items-center justify-center p-[20px] text-textColor">
        You do not have access to this page.
      </div>
    );
  }

  return <>{children}</>;
};

export const AdminLayout: FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();

  const list = useMemo(
    () => [
      { tab: 'general', label: t('general', 'General'), path: '/admin' },
      { tab: 'users', label: t('users', 'Users'), path: '/admin/users' },
      { tab: 'errors', label: t('errors', 'Errors'), path: '/admin/errors' },
      { tab: 'stats', label: t('stats', 'Stats'), path: '/admin/stats' },
    ],
    [t]
  );

  const tab = useMemo(() => {
    if (pathname === '/admin/users') {
      return 'users';
    }
    if (pathname === '/admin/errors') {
      return 'errors';
    }
    if (pathname === '/admin/stats') {
      return 'stats';
    }
    return 'general';
  }, [pathname]);

  return (
    <AdminGuard>
      <div className="bg-newBgColorInner p-[20px] flex flex-col transition-all w-[260px]">
        <div className="flex flex-1 flex-col gap-[15px]">
          {list.map(({ tab: tabKey, label, path }) => (
            <div
              key={tabKey}
              className={clsx(
                'cursor-pointer flex items-center gap-[12px] group/profile hover:bg-boxHover rounded-e-[8px]',
                tabKey === tab && 'bg-boxHover'
              )}
              onClick={() => router.push(path)}
            >
              <div
                className={clsx(
                  'h-full w-[4px] rounded-s-[3px] opacity-0 group-hover/profile:opacity-100 transition-opacity',
                  tabKey === tab && 'opacity-100'
                )}
              >
                <SVGLine />
              </div>
              {label}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-newBgColorInner flex-1 flex-col flex p-[20px] gap-[12px] overflow-y-auto min-h-0">
        {tab === 'general' && <AdminGeneralComponent />}
        {tab === 'users' && <AdminUsersComponent />}
        {tab === 'errors' && <AdminErrorsComponent />}
        {tab === 'stats' && <AdminStatsComponent />}
      </div>
    </AdminGuard>
  );
};
