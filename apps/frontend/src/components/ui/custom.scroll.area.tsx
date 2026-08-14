'use client';

import { CSSProperties, FC, ReactNode, useMemo } from 'react';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import type { OverlayScrollbars } from 'overlayscrollbars';
import clsx from 'clsx';
import 'overlayscrollbars/overlayscrollbars.css';

const DEFAULT_OPTIONS = {
  overflow: {
    x: 'hidden' as const,
    y: 'scroll' as const,
  },
  scrollbars: {
    autoHide: 'scroll' as const,
    autoHideDelay: 800,
    theme: 'os-theme-postiz',
  },
};

export const CustomScrollArea: FC<{
  className?: string;
  contentClassName?: string;
  children: ReactNode;
  maxHeight?: string | number;
  id?: string;
  onScroll?: (viewport: HTMLElement) => void;
}> = ({ className, contentClassName, children, maxHeight, id, onScroll }) => {
  const style = useMemo<CSSProperties | undefined>(
    () => (maxHeight ? { maxHeight } : undefined),
    [maxHeight]
  );

  return (
    <OverlayScrollbarsComponent
      defer
      id={id}
      className={clsx('min-h-0', className)}
      style={style}
      options={DEFAULT_OPTIONS}
      events={
        onScroll
          ? {
            scroll: (instance: OverlayScrollbars) => {
              onScroll(instance.elements().viewport);
            },
          }
          : undefined
      }
    >
      {contentClassName ? (
        <div className={contentClassName}>{children}</div>
      ) : (
        children
      )}
    </OverlayScrollbarsComponent>
  );
};
