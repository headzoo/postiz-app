'use client';

import {
  FC,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useState,
} from 'react';
import clsx from 'clsx';
import { useClickOutside } from '@mantine/hooks';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { CheckmarkIcon, PlusIcon } from '@gitroom/frontend/components/ui/icons';
import { FollowerList } from '@gitroom/frontend/components/followers/use.followers';

export const FollowerListDropdown: FC<{
  lists: FollowerList[];
  assignedListIds: string[];
  onToggle: (list: FollowerList, assigned: boolean) => Promise<void> | void;
}> = ({ lists, assignedListIds, onToggle }) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const assigned = new Set(assignedListIds);

  const stopCardAction = (event: MouseEvent | KeyboardEvent) => {
    event.stopPropagation();
  };

  const toggleOpen = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    setOpen((current) => !current);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={toggleOpen}
        onKeyDown={stopCardAction}
        className={clsx(
          'inline-flex h-[20px] w-[20px] items-center justify-center rounded-full border text-[12px]',
          'border-newTableBorder text-textItemBlur hover:border-newTextColor/40 hover:text-newTextColor'
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('followers_add_to_list', 'Add to list')}
      >
        <PlusIcon size={12} />
      </button>
      {open && (
        <div
          role="menu"
          className="menu-shadow absolute start-0 top-[26px] z-20 min-w-[180px] rounded-[8px] border border-newTableBorder bg-newBgColorInner p-[6px]"
          onClick={stopCardAction}
          onKeyDown={stopCardAction}
        >
          {lists.length ? (
            lists.map((list) => {
              const isAssigned = assigned.has(list.id);
              return (
                <button
                  key={list.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={isAssigned}
                  className="flex w-full items-center justify-between gap-[8px] rounded-[6px] px-[8px] py-[6px] text-start text-[13px] text-newTextColor hover:bg-newTableHeader"
                  onClick={async (event) => {
                    event.stopPropagation();
                    await onToggle(list, isAssigned);
                  }}
                >
                  <span className="truncate">{list.name}</span>
                  {isAssigned && <CheckmarkIcon size={14} />}
                </button>
              );
            })
          ) : (
            <p className="px-[8px] py-[6px] text-[13px] text-textItemBlur">
              {t(
                'followers_lists_empty_menu',
                'Create a custom list first.'
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
