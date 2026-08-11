'use client';

import { FC, useEffect, useState } from 'react';
import { useOpenGraphPreview } from './use.open.graph.preview';

function getDisplaySiteLabel(url: string, siteName?: string | null): string {
  if (siteName?.trim()) {
    return siteName.trim();
  }

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export const ComposerOpenGraphPreview: FC<{
  content?: string | null;
}> = ({ content }) => {
  const { data, error, contentUrl, requestUrl } = useOpenGraphPreview(content);
  const [imageHidden, setImageHidden] = useState(false);

  useEffect(() => {
    setImageHidden(false);
  }, [contentUrl, data?.image]);

  if (
    !contentUrl ||
    !requestUrl ||
    contentUrl !== requestUrl ||
    error ||
    !data
  ) {
    return null;
  }

  const hasImage = !!data.image && !imageHidden;
  const hasTitle = !!data.title?.trim();
  const hasDescription = !!data.description?.trim();

  if (!hasImage && !hasTitle && !hasDescription) {
    return null;
  }

  const siteLabel = getDisplaySiteLabel(data.url, data.siteName);

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mx-[15px] mb-[15px] border border-newTableBorder bg-newBgColorInner rounded-[8px] overflow-hidden no-underline hover:border-newTextColor/20 transition-colors"
    >
      {hasImage && (
        <div className="w-full aspect-[1.91/1] max-h-[200px] bg-newTextColor/5 overflow-hidden">
          <img
            src={data.image!}
            alt={data.imageAlt?.trim() || ''}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => setImageHidden(true)}
          />
        </div>
      )}
      <div className="px-[12px] py-[10px] flex flex-col gap-[4px]">
        {siteLabel && (
          <div className="text-[12px] text-newTableText uppercase tracking-wide truncate">
            {siteLabel}
          </div>
        )}
        {hasTitle && (
          <div className="text-[14px] font-semibold text-newTextColor line-clamp-2">
            {data.title}
          </div>
        )}
        {hasDescription && (
          <div className="text-[13px] text-newTableText line-clamp-2">
            {data.description}
          </div>
        )}
      </div>
    </a>
  );
};
