'use client';

import {
  FC,
  Fragment,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { useDrag, useDrop } from 'react-dnd';
import { Button } from '@gitroom/react/form/button';
import { DNDProvider } from '@gitroom/frontend/components/launches/helpers/dnd.provider';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { getTimezone } from '@gitroom/frontend/components/layout/set.timezone';
import { useDecisionModal } from '@gitroom/frontend/components/layout/new-modal';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  getPipelineScheduleWeek,
  getReadableForegroundColor,
  minuteOfDayToTime,
  PIPELINE_DAYS,
  PIPELINE_SCHEDULE_DRAG_TYPE,
  convertDisplayScheduleTargetToPipelineSlot,
  pipelineScheduleSlotsEqual,
} from '@gitroom/frontend/components/pipelines/pipeline.utils';
import {
  PipelineScheduleOccurrence,
  PipelineScheduleDragItem,
} from '@gitroom/frontend/components/pipelines/pipeline.types';
import {
  pipelineGlobalScheduleKey,
  usePipelineGlobalSchedule,
} from '@gitroom/frontend/components/pipelines/use.pipeline.global.schedule';
import { useDeletePipelineScheduleSlot } from '@gitroom/frontend/components/pipelines/use.pipeline.schedule.slot.delete';
import { useMovePipelineScheduleSlot } from '@gitroom/frontend/components/pipelines/use.pipeline.schedule.slot.move';
import { useScrollToHour } from '@gitroom/frontend/components/launches/helpers/use.scroll.to.hour';
import {
  CollapseIcon,
  ExpandIcon,
} from '@gitroom/frontend/components/ui/icons';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const formatDateHeader = (date: dayjs.Dayjs, timezone: string) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    weekday: 'short',
  }).format(date.toDate());

const formatHour = (hour: number) =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2020, 0, 1, hour)));

const formatOccurrenceDetails = (
  occurrence: PipelineScheduleOccurrence,
  displayTimezone: string
) => {
  const scheduledFor = new Intl.DateTimeFormat(undefined, {
    timeZone: displayTimezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(occurrence.scheduledFor));
  const sourceDay = PIPELINE_DAYS[occurrence.dayOfWeek]?.label;
  return `${scheduledFor} · ${occurrence.pipelineTimezone} · ${occurrence.active ? 'Active' : 'Paused'
    } · Source: ${sourceDay} ${minuteOfDayToTime(occurrence.minuteOfDay)}`;
};

const PipelineScheduleOccurrencePill: FC<{
  occurrence: PipelineScheduleOccurrence;
  displayTimezone: string;
  pending: boolean;
  onRemove: (occurrence: PipelineScheduleOccurrence) => void;
  pausedLabel: string;
  removeLabel: string;
  slotLabel: string;
}> = ({
  occurrence,
  displayTimezone,
  pending,
  onRemove,
  pausedLabel,
  removeLabel,
  slotLabel,
}) => {
    const [{ isDragging }, drag] = useDrag(
      () => ({
        type: PIPELINE_SCHEDULE_DRAG_TYPE,
        item: {
          source: {
            dayOfWeek: occurrence.dayOfWeek,
            minuteOfDay: occurrence.minuteOfDay,
          },
          occurrenceId: occurrence.id,
          pipelineId: occurrence.pipelineId,
          pipelineName: occurrence.pipelineName,
          pipelineTimezone: occurrence.pipelineTimezone,
          pipelineColor: occurrence.pipelineColor,
          active: occurrence.active,
          expectedScheduleRevision: occurrence.scheduleRevision,
        } satisfies PipelineScheduleDragItem,
        canDrag: !pending,
        collect: (monitor) => ({ isDragging: monitor.isDragging() }),
      }),
      [occurrence, pending]
    );
    const sourceDay = PIPELINE_DAYS[occurrence.dayOfWeek]?.label;
    const sourceTime = minuteOfDayToTime(occurrence.minuteOfDay);
    const details = formatOccurrenceDetails(occurrence, displayTimezone);
    const activeForeground = occurrence.active
      ? getReadableForegroundColor(occurrence.pipelineColor)
      : undefined;

    return (
      <div
        // @ts-ignore react-dnd connector type
        ref={drag}
        title={details}
        className={clsx(
          'flex min-w-0 items-center justify-between gap-[4px] rounded-[6px] px-[7px] py-[5px] text-[12px]',
          !pending && 'cursor-grab active:cursor-grabbing',
          isDragging && 'opacity-40',
          occurrence.active
            ? ''
            : 'border border-newBorder bg-newBgColorInner text-textColor opacity-60'
        )}
        style={
          occurrence.active
            ? {
              backgroundColor: occurrence.pipelineColor,
              color: activeForeground,
            }
            : undefined
        }
      >
        <span
          className="min-w-0 truncate"
          aria-label={`${occurrence.pipelineName}. ${details}`}
        >
          {occurrence.pipelineName}
        </span>
        {!occurrence.active && (
          <span className="shrink-0 rounded-[3px] border border-current px-[3px] py-[1px] text-[10px]">
            {pausedLabel}
          </span>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => onRemove(occurrence)}
          className="inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded hover:bg-newBgColor/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-btnPrimary disabled:cursor-not-allowed"
          aria-label={`${removeLabel} ${occurrence.pipelineName} ${sourceDay} ${sourceTime} ${slotLabel}`}
        >
          <svg
            viewBox="0 0 12 12"
            className="h-[10px] w-[10px]"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M2.5 2.5l7 7M9.5 2.5l-7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    );
  };

const PipelineScheduleDropZone: FC<{
  date: string;
  minuteOfDay: number;
  className?: string;
  onDrop: (
    item: PipelineScheduleDragItem,
    displayCalendarDate: string,
    targetDisplayMinuteOfDay: number
  ) => void;
  children: ReactNode;
}> = ({ date, minuteOfDay, className, onDrop, children }) => {
  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: PIPELINE_SCHEDULE_DRAG_TYPE,
      drop: (item: PipelineScheduleDragItem) => onDrop(item, date, minuteOfDay),
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop(),
      }),
    }),
    [date, minuteOfDay, onDrop]
  );

  return (
    <div
      // @ts-ignore react-dnd connector type
      ref={drop}
      className={clsx(
        'flex min-h-[32px] flex-1 flex-col gap-[4px] rounded-[4px]',
        isOver &&
        canDrop &&
        'bg-btnPrimary/10 outline outline-1 outline-btnPrimary/40',
        className
      )}
    >
      {children}
    </div>
  );
};

export const PipelineGlobalSchedule: FC = () => {
  const t = useT();
  const router = useRouter();
  const decision = useDecisionModal();
  const toaster = useToaster();
  const [displayTimezone, setDisplayTimezone] = useState<string>();
  const [pendingOccurrenceIds, setPendingOccurrenceIds] = useState<Set<string>>(
    new Set()
  );
  const [scheduleError, setScheduleError] = useState('');
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);

  useEffect(() => {
    setDisplayTimezone(getTimezone());
  }, []);

  const week = useMemo(
    () =>
      displayTimezone ? getPipelineScheduleWeek(displayTimezone) : undefined,
    [displayTimezone]
  );
  const globalScheduleKey = week
    ? pipelineGlobalScheduleKey(week.startDate, week.endDate)
    : undefined;
  const { data, error, isLoading, mutate } = usePipelineGlobalSchedule(
    week?.startDate,
    week?.endDate
  );
  const deleteScheduleSlot = useDeletePipelineScheduleSlot(globalScheduleKey);
  const moveScheduleSlot = useMovePipelineScheduleSlot(globalScheduleKey);

  const occurrencesByCell = useMemo(() => {
    const cells = new Map<string, PipelineScheduleOccurrence[]>();
    if (!data || !displayTimezone) {
      return cells;
    }
    for (const occurrence of data) {
      const localTime = dayjs(occurrence.scheduledFor).tz(displayTimezone);
      const key = `${localTime.format('YYYY-MM-DD')}:${localTime.hour()}:${localTime.minute() >= 30 ? 30 : 0
        }`;
      cells.set(key, [...(cells.get(key) || []), occurrence]);
    }
    return cells;
  }, [data, displayTimezone]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const earliestHour = useMemo(() => {
    if (isLoading || !data?.length || !displayTimezone) {
      return null;
    }
    let minHour: number | null = null;
    for (const occurrence of data) {
      const hour = dayjs(occurrence.scheduledFor).tz(displayTimezone).hour();
      if (minHour === null || hour < minHour) {
        minHour = hour;
      }
    }
    return minHour;
  }, [data, displayTimezone, isLoading]);
  useScrollToHour(scrollRef, earliestHour, week?.startDate || '');

  const removeSlot = useCallback(
    async (occurrence: PipelineScheduleOccurrence) => {
      if (pendingOccurrenceIds.has(occurrence.id)) {
        return;
      }
      const day = PIPELINE_DAYS[occurrence.dayOfWeek]?.label;
      const sourceTime = minuteOfDayToTime(occurrence.minuteOfDay);
      const approved = await decision.open({
        title: t(
          'remove_pipeline_schedule_slot',
          'Remove Pipeline schedule slot?'
        ),
        description: `Removing "${occurrence.pipelineName}" on ${day} at ${sourceTime} (${occurrence.pipelineTimezone}) will remove this recurring source slot from every future week.`,
        approveLabel: t('remove', 'Remove'),
        cancelLabel: t('cancel', 'Cancel'),
      });
      if (!approved) {
        return;
      }

      setScheduleError('');
      setPendingOccurrenceIds((current) => new Set(current).add(occurrence.id));
      try {
        await deleteScheduleSlot(occurrence.pipelineId, {
          dayOfWeek: occurrence.dayOfWeek,
          minuteOfDay: occurrence.minuteOfDay,
        });
        toaster.show(
          t(
            'pipeline_schedule_slot_removed',
            'Pipeline schedule slot removed.'
          ),
          'success'
        );
      } catch (err: any) {
        const message =
          err?.message ||
          t(
            'pipeline_schedule_slot_remove_failed',
            'Failed to remove the Pipeline schedule slot. The schedule has been refreshed.'
          );
        setScheduleError(message);
        toaster.show(message, 'warning');
        await mutate();
      } finally {
        setPendingOccurrenceIds((current) => {
          const next = new Set(current);
          next.delete(occurrence.id);
          return next;
        });
      }
    },
    [decision, deleteScheduleSlot, mutate, pendingOccurrenceIds, t, toaster]
  );

  const moveSlot = useCallback(
    async (
      item: PipelineScheduleDragItem,
      displayCalendarDate: string,
      targetDisplayMinuteOfDay: number
    ) => {
      if (
        !item.occurrenceId ||
        !item.pipelineId ||
        !item.pipelineName ||
        !item.pipelineTimezone ||
        item.expectedScheduleRevision === undefined ||
        pendingOccurrenceIds.has(item.occurrenceId)
      ) {
        return;
      }

      const conversion = convertDisplayScheduleTargetToPipelineSlot(
        displayCalendarDate,
        targetDisplayMinuteOfDay,
        displayTimezone!,
        item.pipelineTimezone
      );
      if (!conversion.ok) {
        toaster.show(
          t(
            'pipeline_schedule_slot_invalid_target',
            'This displayed time does not exist in the selected timezone.'
          ),
          'warning'
        );
        return;
      }

      const target = {
        dayOfWeek: conversion.dayOfWeek,
        minuteOfDay: conversion.minuteOfDay,
      };
      if (pipelineScheduleSlotsEqual(item.source, target)) {
        return;
      }
      if (
        data?.some(
          (occurrence) =>
            occurrence.id !== item.occurrenceId &&
            occurrence.pipelineId === item.pipelineId &&
            pipelineScheduleSlotsEqual(occurrence, target)
        )
      ) {
        toaster.show(
          t(
            'pipeline_schedule_slot_occupied',
            'This Pipeline already has a recurring schedule slot at that time.'
          ),
          'warning'
        );
        return;
      }

      const sourceDay = PIPELINE_DAYS[item.source.dayOfWeek]?.label;
      const targetDay = PIPELINE_DAYS[target.dayOfWeek]?.label;
      const approved = await decision.open({
        title: t('move_pipeline_schedule_slot', 'Move Pipeline schedule slot?'),
        description: `Moving "${item.pipelineName
          }" from ${sourceDay} at ${minuteOfDayToTime(
            item.source.minuteOfDay
          )} to ${targetDay} at ${minuteOfDayToTime(target.minuteOfDay)} (${item.pipelineTimezone
          }) will update this recurring source slot for every future week.`,
        approveLabel: t('confirm', 'Confirm'),
        cancelLabel: t('cancel', 'Cancel'),
      });
      if (!approved) {
        return;
      }

      setScheduleError('');
      setPendingOccurrenceIds((current) =>
        new Set(current).add(item.occurrenceId!)
      );
      try {
        await moveScheduleSlot(item.pipelineId, {
          sourceDayOfWeek: item.source.dayOfWeek,
          sourceMinuteOfDay: item.source.minuteOfDay,
          targetDayOfWeek: target.dayOfWeek,
          targetMinuteOfDay: target.minuteOfDay,
          expectedScheduleRevision: item.expectedScheduleRevision,
        });
        toaster.show(
          t('pipeline_schedule_slot_moved', 'Pipeline schedule slot moved.'),
          'success'
        );
      } catch (err: any) {
        const message =
          err?.message ||
          t(
            'pipeline_schedule_slot_move_failed',
            'Failed to move the Pipeline schedule slot. The schedule has been refreshed.'
          );
        setScheduleError(message);
        toaster.show(message, 'warning');
        await mutate();
      } finally {
        setPendingOccurrenceIds((current) => {
          const next = new Set(current);
          next.delete(item.occurrenceId!);
          return next;
        });
      }
    },
    [
      data,
      decision,
      displayTimezone,
      moveScheduleSlot,
      mutate,
      pendingOccurrenceIds,
      t,
      toaster,
    ]
  );

  const today = displayTimezone
    ? dayjs().tz(displayTimezone).format('YYYY-MM-DD')
    : '';

  const expandLabel = isCalendarExpanded
    ? t('collapse_calendar', 'Collapse calendar')
    : t('expand_calendar', 'Expand calendar');

  return (
    <DNDProvider>
      <div
        className={clsx(
          'bg-newBgColorInner flex flex-1 flex-col min-h-0 min-w-0 text-textColor',
          isCalendarExpanded ? 'p-0 overflow-hidden' : 'p-[20px] gap-[20px] overflow-y-auto overflow-x-hidden'
        )}
      >
        {!isCalendarExpanded && (
          <>
            <div className="flex flex-col gap-[12px]">
              <Button
                secondary
                className="self-start"
                onClick={() => router.push('/pipelines')}
              >
                {t('back_to_pipelines', 'Back to Pipelines')}
              </Button>
              <div className="flex flex-col gap-[6px]">
                <h1 className="text-[24px] font-[600]">
                  {t('pipeline_schedule', 'Pipeline Schedule')}
                </h1>
                <p className="max-w-[760px] text-[14px] opacity-70">
                  {t(
                    'pipeline_schedule_description',
                    'Compare configured recurring Pipeline slots for this week. Times are shown in your selected timezone.'
                  )}
                </p>
                <p className="text-[13px] opacity-70">
                  {displayTimezone
                    ? `${t(
                      'display_timezone',
                      'Display timezone'
                    )}: ${displayTimezone}`
                    : t('loading_timezone', 'Loading selected timezone…')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-[12px] text-[13px]">
              <span className="font-[500]">{t('legend', 'Legend')}:</span>
              <span className="flex items-center gap-[6px]">
                <span className="h-[12px] w-[12px] rounded-[3px] bg-gradient-to-r from-[#E80000] via-[#eb3825] to-[#00BA73]" />
                {t(
                  'pipeline_schedule_active_legend',
                  'Active entries use Pipeline colors'
                )}
              </span>
              <span className="flex items-center gap-[6px] opacity-60">
                <span className="h-[12px] w-[12px] rounded-[3px] border border-newBorder bg-newBgColor" />
                {t('paused', 'Paused')}
              </span>
            </div>
          </>
        )}

        {scheduleError && (
          <div className="rounded-[12px] border border-red-500/30 bg-newBgColor px-[16px] py-[12px] text-[14px] text-red-500">
            {scheduleError}
          </div>
        )}

        {!displayTimezone || isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-[12px] border border-newBorder bg-newBgColor">
            <LoadingComponent />
          </div>
        ) : error ? (
          <div className="rounded-[12px] border border-red-500/30 bg-newBgColor px-[16px] py-[12px] text-[14px] text-red-500">
            {t(
              'pipeline_schedule_load_error',
              'Failed to load Pipeline schedules for this week. Please refresh and try again.'
            )}
          </div>
        ) : !data?.length ? (
          <div className="rounded-[12px] border border-newBorder bg-newBgColor px-[16px] py-[32px] text-center text-[14px] opacity-70">
            {t(
              'pipeline_schedule_empty',
              'No configured Pipeline schedules this week.'
            )}
          </div>
        ) : (
          <div
            className={clsx(
              'relative flex flex-col min-h-0',
              isCalendarExpanded && 'flex-1'
            )}
          >
            <button
              type="button"
              className="absolute end-[10px] top-[10px] z-40 text-textColor opacity-70 hover:opacity-100"
              aria-label={expandLabel}
              data-tooltip-id="tooltip"
              data-tooltip-content={expandLabel}
              onClick={() => setIsCalendarExpanded((value) => !value)}
            >
              {isCalendarExpanded ? <CollapseIcon /> : <ExpandIcon />}
            </button>
            <div
              ref={scrollRef}
              className={clsx(
                'overflow-auto rounded-[10px] border border-newBorder bg-newBorder scrollbar scrollbar-thumb-newBorder scrollbar-track-newBgColor',
                isCalendarExpanded
                  ? 'flex-1 min-h-0'
                  : 'max-h-[calc(100vh-280px)] min-h-[420px]'
              )}
            >
              <div className="grid min-w-[1004px] grid-cols-[80px_repeat(7,_minmax(132px,_1fr))] gap-px">
                <div className="sticky start-0 top-0 z-30 h-[62px] bg-newTableHeader" />
                {week!.days.map((date) => {
                  const dateKey = date.format('YYYY-MM-DD');
                  return (
                    <div
                      key={dateKey}
                      className="sticky top-0 z-20 flex h-[62px] flex-col items-center justify-center bg-newTableHeader px-[8px] text-center text-[14px] font-[500] text-newTableText"
                    >
                      <span>{formatDateHeader(date, displayTimezone)}</span>
                      {dateKey === today && (
                        <span className="text-[12px] text-newTableTextFocused">
                          {t('today', 'Today')}
                        </span>
                      )}
                    </div>
                  );
                })}
                {HOURS.map((hour) => (
                  <Fragment key={hour}>
                    <div
                      data-hour={hour}
                      className="sticky start-0 z-10 flex min-h-[76px] items-start justify-end bg-newBgColor px-[12px] pt-[10px] text-[13px] text-newTableText scroll-mt-[62px]"
                    >
                      {formatHour(hour)}
                    </div>
                    {week!.days.map((date) => {
                      const firstHalfOccurrences =
                        occurrencesByCell.get(
                          `${date.format('YYYY-MM-DD')}:${hour}:0`
                        ) || [];
                      const secondHalfOccurrences =
                        occurrencesByCell.get(
                          `${date.format('YYYY-MM-DD')}:${hour}:30`
                        ) || [];
                      return (
                        <div
                          key={`${date.format('YYYY-MM-DD')}-${hour}`}
                          className={clsx(
                            'flex min-h-[76px] flex-col gap-[4px] bg-newBgColor p-[6px]',
                            date.format('YYYY-MM-DD') === today &&
                            'bg-newBgColorInner'
                          )}
                        >
                          {[0, 30].map((minute) => {
                            const occurrences =
                              minute === 0
                                ? firstHalfOccurrences
                                : secondHalfOccurrences;
                            return (
                              <PipelineScheduleDropZone
                                key={minute}
                                date={date.format('YYYY-MM-DD')}
                                minuteOfDay={hour * 60 + minute}
                                onDrop={moveSlot}
                              >
                                {occurrences.map((occurrence) => (
                                  <PipelineScheduleOccurrencePill
                                    key={occurrence.id}
                                    occurrence={occurrence}
                                    displayTimezone={displayTimezone}
                                    pending={pendingOccurrenceIds.has(
                                      occurrence.id
                                    )}
                                    onRemove={removeSlot}
                                    pausedLabel={t('paused', 'Paused')}
                                    removeLabel={t('remove', 'Remove')}
                                    slotLabel={t(
                                      'pipeline_schedule_slot',
                                      'Pipeline schedule slot'
                                    )}
                                  />
                                ))}
                              </PipelineScheduleDropZone>
                            );
                          })}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </DNDProvider>
  );
};
