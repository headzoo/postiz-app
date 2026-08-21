'use client';

import { FC } from 'react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { isUSCitizen } from '@gitroom/frontend/components/launches/helpers/isuscitizen.utils';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import { MetricDayAnalyticsPost } from '@gitroom/frontend/components/analytics/metric-day/use.metric.day.analytics';

dayjs.extend(utc);

export const formatMetricContribution = (delta: number) => {
  const rounded = Math.round(delta);
  const prefix = rounded > 0 ? '+' : '';
  return `${prefix}${new Intl.NumberFormat().format(rounded)}`;
};

export const MetricDayPostList: FC<{
  posts: MetricDayAnalyticsPost[];
  channelName?: string | null;
  channelPicture?: string | null;
  channelIdentifier?: string | null;
}> = ({ posts, channelName, channelPicture, channelIdentifier }) => {
  const t = useT();

  return (
    <div className="flex flex-col gap-[12px]">
      {posts.map((post) => {
        const excerpt =
          stripHtmlValidation('none', post.content, false, true, false) ||
          t('no_content', 'no content');

        return (
          <article
            key={post.id}
            className="w-full flex flex-col overflow-hidden rounded-[12px] border border-newTableBorder bg-newTableHeader"
          >
            <div className="flex h-[24px] min-h-[24px] max-h-[24px] w-full items-center gap-[6px] rounded-tl-[10px] rounded-tr-[10px] bg-btnPrimary px-[8px] text-[11px] text-white">
              <ImageWithFallback
                fallbackSrc="/no-picture.jpg"
                src={channelPicture || '/no-picture.jpg'}
                className="rounded-[4px]"
                alt={channelIdentifier || 'channel'}
                width={18}
                height={18}
              />
              <div className="min-w-0 flex-1 truncate text-start font-[600]">
                {channelName || channelIdentifier || t('channel', 'Channel')}
              </div>
              <div className="shrink-0 text-[12px] font-semibold">
                {formatMetricContribution(post.delta)}
              </div>
            </div>
            <div className="flex flex-col gap-[6px] rounded-bl-[10px] rounded-br-[10px] bg-newColColor p-[12px] text-[14px] text-newTableText">
              <div className="flex min-w-0 items-start gap-[8px]">
                <div className="min-w-0 flex-1 break-words text-start line-clamp-3">
                  {excerpt}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-[8px] text-[12px] text-newTableText/70">
                <span>
                  {dayjs(post.publishDate)
                    .local()
                    .format(
                      isUSCitizen() ? 'MMM D, YYYY h:mm A' : 'D MMM YYYY HH:mm'
                    )}
                </span>
                {post.releaseURL && (
                  <a
                    href={post.releaseURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={clsx(
                      'text-[12px] font-medium text-[#1d9bf0] hover:underline'
                    )}
                  >
                    {t('view_post', 'View post')}
                  </a>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
};
