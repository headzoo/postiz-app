'use client';

import { RefObject, useEffect, useRef } from 'react';

const STICKY_HEADER_PX = 62;

export const useScrollToHour = (
  containerRef: RefObject<HTMLElement | null>,
  hour: number | null,
  resetKey: string
) => {
  const lastScrolledKey = useRef<string | null>(null);

  useEffect(() => {
    if (hour == null) {
      return;
    }

    const scrollKey = `${resetKey}:${hour}`;
    if (lastScrolledKey.current === scrollKey) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      if (hour <= 0) {
        container.scrollTop = 0;
        lastScrolledKey.current = scrollKey;
        return;
      }

      const target = container.querySelector(`[data-hour="${hour}"]`);
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const top =
        target.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        STICKY_HEADER_PX;

      container.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
      lastScrolledKey.current = scrollKey;
    });

    return () => cancelAnimationFrame(frame);
  }, [containerRef, hour, resetKey]);
};
