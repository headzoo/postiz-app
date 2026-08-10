'use client';

import { AddProviderButton } from '@gitroom/frontend/components/launches/add.provider.component';
import { GeneratorComponent } from '@gitroom/frontend/components/launches/generator/generator';
import { NewPost } from '@gitroom/frontend/components/launches/new.post';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import clsx from 'clsx';
import { capitalize } from 'lodash';
import {
  FC,
  ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';
import useCookie from 'react-use-cookie';
import { useDrag, useDrop } from 'react-dnd';
import { groupBy, orderBy } from 'lodash';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { Menu } from '@gitroom/frontend/components/launches/menu/menu';
import { IntegrationListItem } from '@gitroom/frontend/components/launches/helpers/use.integration.list';

export const ChannelsSidebar = ({
  integrationCount,
  onUpdate,
  children,
  showCalendarActions = false,
}: {
  integrationCount: number;
  onUpdate: (shouldReload: boolean) => void;
  children: (collapsed: boolean) => ReactNode;
  showCalendarActions?: boolean;
}) => {
  const user = useUser();
  const { billingEnabled } = useVariables();
  const t = useT();
  const [collapseMenu, setCollapseMenu] = useCookie('collapseMenu', '0');
  const [mode] = useCookie('mode', 'dark');
  const collapsed = collapseMenu === '1';

  return (
    <div
      className={clsx(
        'flex relative flex-col',
        collapsed ? 'group sidebar w-[100px]' : 'w-[260px]'
      )}
    >
      <div className="bg-newBgColorInner p-[20px] flex flex-col gap-[15px] transition-all absolute start-0 top-0 w-full h-full overflow-x-hidden overflow-y-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
        <div className="flex items-center">
          <h2 className="group-[.sidebar]:hidden flex-1 text-[20px] font-[500]">
            {t('channels')}
          </h2>
          <div
            onClick={() => setCollapseMenu(collapsed ? '0' : '1')}
            className="group-[.sidebar]:rotate-[180deg] group-[.sidebar]:mx-auto text-btnText bg-btnSimple rounded-[6px] w-[24px] h-[24px] flex items-center justify-center cursor-pointer select-none"
          >
            <svg width="7" height="13" viewBox="0 0 7 13" fill="none">
              <path
                d="M6 11.5L1 6.5L6 1.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <div className="flex flex-col gap-[8px] group-[.sidebar]:mx-auto group-[.sidebar]:w-[44px]">
          <AddProviderButton update={() => onUpdate(true)} />
          {showCalendarActions && (
            <div className="flex gap-[8px] group-[.sidebar]:flex-col">
              {integrationCount > 0 && <NewPost />}
              {integrationCount > 0 && user?.tier?.ai && billingEnabled && (
                <GeneratorComponent />
              )}
            </div>
          )}
        </div>
        <div className="gap-[32px] flex flex-col select-none flex-1">
          {integrationCount === 0 && !collapsed && (
            <div className="flex-1 max-h-[500px] justify-center items-center flex">
              <div className="flex flex-col gap-[12px] text-center">
                <img
                  src={
                    mode === 'dark'
                      ? '/no-channels.svg'
                      : '/no-channels-colors.svg'
                  }
                  alt="No channels"
                  className="mx-auto min-w-[100%]"
                />
                <div className="font-[600] text-[20px]">
                  {t('no_channels', 'No channels yet')}
                </div>
                <div className="text-[14px]">
                  {t('connect_your_accounts')}
                </div>
              </div>
            </div>
          )}
          {children(collapsed)}
        </div>
        <div className="mt-[5px] text-center flex flex-col">
          {billingEnabled && user?.isLifetime && (
            <div>{capitalize(user?.tier?.current || '')} tier</div>
          )}
          <div>{process.env.NEXT_PUBLIC_VERSION || ''}</div>
        </div>
      </div>
    </div>
  );
};

const OpenClose: FC<{ isOpen: boolean }> = ({ isOpen }) => (
  <svg
    width="11"
    height="6"
    viewBox="0 0 22 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={clsx(
      'rotate-180 transition-all',
      isOpen ? 'rotate-180' : 'rotate-90'
    )}
  >
    <path
      d="M21.9245 11.3823C21.8489 11.5651 21.7207 11.7213 21.5563 11.8312C21.3919 11.9411 21.1986 11.9998 21.0008 11.9998H1.00079C0.802892 12 0.609399 11.9414 0.444805 11.8315C0.280212 11.7217 0.151917 11.5654 0.076165 11.3826C0.000412494 11.1998 -0.0193921 10.9986 0.0192583 10.8045C0.0579087 10.6104 0.153276 10.4322 0.293288 10.2923L10.2933 0.29231C10.3862 0.199333 10.4964 0.125575 10.6178 0.0752506C10.7392 0.0249263 10.8694 -0.000976562 11.0008 -0.000976562C11.1322 -0.000976562 11.2623 0.0249263 11.3837 0.0752506C11.5051 0.125575 11.6154 0.199333 11.7083 0.29231L21.7083 10.2923C21.8481 10.4322 21.9433 10.6105 21.9818 10.8045C22.0202 10.9985 22.0003 11.1996 21.9245 11.3823Z"
      fill="currentColor"
    />
  </svg>
);

type ChannelMenuProps = {
  integrations: IntegrationListItem[];
  mutate: () => void;
  onUpdate: (shouldReload: boolean) => void;
  onGroupChange: (id: string, group: string) => void;
  onRefreshChannel: (integration: IntegrationListItem) => () => void;
  onContinueIntegration: (integration: IntegrationListItem) => () => void;
};

type ChannelGroup = {
  id: string;
  name: string;
  values: IntegrationListItem[];
};

const ChannelMenuRow: FC<
  Omit<ChannelMenuProps, 'onGroupChange'> & {
    collapsed: boolean;
    integration: IntegrationListItem;
  }
> = ({
  integrations,
  mutate,
  onUpdate,
  onRefreshChannel,
  onContinueIntegration,
  collapsed,
  integration,
}) => {
  const user = useUser();
  const [{}, drag, dragPreview] = useDrag(() => ({
    type: 'menu',
    item: { id: integration.id },
  }));
  const totalNonDisabledChannels = useMemo(
    () => integrations.filter((item) => !item.disabled).length,
    [integrations]
  );

  return (
    <div
      ref={(node) => {
        dragPreview(node);
      }}
      {...(integration.refreshNeeded && {
        onClick: onRefreshChannel(integration),
        'data-tooltip-id': 'tooltip',
        'data-tooltip-content': 'Channel disconnected, click to reconnect.',
      })}
      {...(collapsed && {
        'data-tooltip-id': 'tooltip',
        'data-tooltip-content': integration.name,
      })}
      className={clsx(
        'flex gap-[12px] items-center bg-newBgColorInner hover:bg-boxHover group/profile transition-all rounded-e-[8px]',
        integration.refreshNeeded && 'cursor-pointer'
      )}
    >
      <div
        className={clsx(
          'relative gap-[6px] flex justify-center items-center',
          integration.disabled && 'opacity-50'
        )}
      >
        {(integration.inBetweenSteps || integration.refreshNeeded) && (
          <div
            className="absolute start-0 top-0 w-[39px] h-[46px] cursor-pointer"
            onClick={
              integration.refreshNeeded
                ? onRefreshChannel(integration)
                : onContinueIntegration(integration)
            }
          >
            <div className="bg-red-500 w-[15px] h-[15px] rounded-full start-[5px] top-[5px] absolute z-[200] text-[10px] flex justify-center items-center">
              !
            </div>
            <div className="bg-primary/60 w-[39px] h-[46px] start-0 top-0 absolute rounded-full z-[199]" />
          </div>
        )}
        <ImageWithFallback
          fallbackSrc="/no-picture.jpg"
          src={integration.picture || '/no-picture.jpg'}
          className="rounded-[8px] min-w-[36px] min-h-[36px]"
          alt={integration.identifier}
          width={36}
          height={36}
        />
        <SafeImage
          src={`/icons/platforms/${integration.identifier}.png`}
          className="rounded-[8px] absolute z-[3] bottom-[5px] -end-[5px] border border-fifth"
          alt={integration.identifier}
          width={18}
          height={18}
        />
      </div>
      <div
        ref={(node) => {
          drag(node);
        }}
        {...(integration.disabled &&
        totalNonDisabledChannels === user?.totalChannels
          ? {
              'data-tooltip-id': 'tooltip',
              'data-tooltip-content':
                'This channel is disabled, please upgrade your plan to enable it.',
            }
          : {})}
        role="handle"
        className={clsx(
          'group-[.sidebar]:hidden flex-1 whitespace-nowrap text-ellipsis overflow-hidden cursor-move',
          integration.disabled && 'opacity-50'
        )}
      >
        {integration.name}
      </div>
      <Menu
        canChangeProfilePicture={integration.changeProfilePicture}
        canChangeNickName={integration.changeNickName}
        integration={integration}
        integrations={integrations}
        refreshChannel={onRefreshChannel}
        mutate={mutate}
        onChange={onUpdate}
        onPostSuccess={mutate}
        canEnable={
          user?.totalChannels! > totalNonDisabledChannels && integration.disabled
        }
        canDisable={!integration.disabled}
      />
    </div>
  );
};

const ChannelMenuGroup: FC<
  ChannelMenuProps & { collapsed: boolean; group: ChannelGroup }
> = ({ group, collapsed, onGroupChange, ...props }) => {
  const [isOpen, setIsOpen] = useState(
    () => typeof window === 'undefined' || !!+(localStorage.getItem(`${group.name}_isOpen`) || '1')
  );
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'menu',
    drop: (item: { id: string }) => onGroupChange(item.id, group.id),
    collect: (monitor) => ({ isOver: !!monitor.isOver() }),
  }));
  const changeOpenClose = useCallback(() => {
    setIsOpen((open) => {
      localStorage.setItem(`${group.name}_isOpen`, open ? '0' : '1');
      return !open;
    });
  }, [group.name]);

  return (
    <div
      className="gap-[16px] flex flex-col relative"
      ref={(node) => {
        drop(node);
      }}
    >
      {isOver && (
        <div className="absolute start-0 top-0 w-full h-full pointer-events-none">
          <div className="bg-white/30 w-full h-full p-[8px] box-content rounded-md" />
        </div>
      )}
      {!!group.name && (
        <button
          className="flex items-center gap-[5px] cursor-pointer text-start"
          onClick={changeOpenClose}
          type="button"
        >
          <OpenClose isOpen={isOpen} />
          <span
            className="line-clamp-1"
            {...(collapsed && {
              'data-tooltip-id': 'tooltip',
              'data-tooltip-content': group.name,
            })}
          >
            {group.name}
          </span>
        </button>
      )}
      <div className={clsx('gap-[12px] flex flex-col relative', !isOpen && 'hidden')}>
        {group.values.map((integration) => (
          <ChannelMenuRow
            {...props}
            collapsed={collapsed}
            key={integration.id}
            integration={integration}
          />
        ))}
      </div>
    </div>
  );
};

export const ChannelMenu: FC<ChannelMenuProps & { collapsed: boolean }> = ({
  integrations,
  collapsed,
  ...props
}) => {
  const groups = useMemo(
    () =>
      orderBy(
        Object.values(groupBy(integrations, (integration) => integration.customer?.id || '')).map(
          (values) => ({
            id: values[0].customer?.id || '',
            name: values[0].customer?.name || '',
            values: orderBy(values, ['type', 'disabled', 'identifier'], ['desc', 'asc', 'asc']),
          })
        ),
        ['name'],
        ['asc']
      ),
    [integrations]
  );

  return (
    <>
      {groups.map((group) => (
        <ChannelMenuGroup
          {...props}
          collapsed={collapsed}
          group={group}
          integrations={integrations}
          key={group.id || 'ungrouped'}
        />
      ))}
    </>
  );
};
