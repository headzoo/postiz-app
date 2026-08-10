'use client';

import { FC } from 'react';
import clsx from 'clsx';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { Integrations } from '@gitroom/frontend/components/launches/calendar.context';

export const PipelineChannels: FC<{
  channels: Integrations[];
  compact?: boolean;
}> = ({ channels, compact }) => {
  if (!channels?.length) {
    return <span className="text-[13px] opacity-60">No channels</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-[6px]">
      {channels.map((channel) => (
        <div
          key={channel.id}
          className={clsx(
            'flex items-center gap-[6px] rounded-[8px] border border-newBorder bg-newBgColor px-[8px]',
            compact ? 'h-[28px]' : 'h-[32px]'
          )}
          title={channel.name}
        >
          <SafeImage
            src={channel.picture}
            alt={channel.name}
            width={compact ? 18 : 20}
            height={compact ? 18 : 20}
            className="rounded-full"
          />
          {!compact && (
            <span className="text-[12px] text-textColor truncate max-w-[120px]">
              {channel.name}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};
