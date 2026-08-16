'use client';

import { RefObject, useEffect, useRef } from 'react';

const STICKY_HEADER_PX = 62;

export type ScrollToHourTarget = {
  hour: number;
  minuteFraction?: number;
  dateKey?: string | null;
};

export const useScrollToHour = (
  containerRef: RefObject<HTMLElement | null>,
  hourOrTarget: number | ScrollToHourTarget | null,
  resetKey: string
) => {
  const lastScrolledKey = useRef<string | null>(null);

  const hour =
    hourOrTarget == null
      ? null
      : typeof hourOrTarget === 'number'
        ? hourOrTarget
        : hourOrTarget.hour;
  const minuteFraction =
    hourOrTarget != null && typeof hourOrTarget === 'object'
      ? hourOrTarget.minuteFraction ?? 0
      : 0;
  const dateKey =
    hourOrTarget != null && typeof hourOrTarget === 'object'
      ? hourOrTarget.dateKey ?? null
      : null;

  useEffect(() => {
    if (hour == null) {
      return;
    }

    const scrollKey = `${resetKey}:${hour}:${minuteFraction}:${dateKey ?? ''}`;
    if (lastScrolledKey.current === scrollKey) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      if (hour <= 0 && minuteFraction <= 0) {
        container.scrollTop = 0;
        lastScrolledKey.current = scrollKey;
        return;
      }

      const target = container.querySelector(`[data-hour="${hour}"]`);
      if (!(target instanceof HTMLElement)) {
        return;
      }

      let top =
        target.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        STICKY_HEADER_PX;

      const cell =
        dateKey != null
          ? container.querySelector(
            `[data-calendar-cell="${dateKey}"][data-hour="${hour}"]`
          )
          : null;
      const heightEl =
        cell instanceof HTMLElement ? cell : target;
      const blockHeight = heightEl.clientHeight;
      top += minuteFraction * blockHeight;
      top -= blockHeight * 0.5;

      container.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
      lastScrolledKey.current = scrollKey;
    });

    return () => cancelAnimationFrame(frame);
  }, [containerRef, dateKey, hour, minuteFraction, resetKey]);
};
