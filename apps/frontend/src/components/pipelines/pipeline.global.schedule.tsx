'use client';

import { FC, Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button } from '@gitroom/react/form/button';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { getTimezone } from '@gitroom/frontend/components/layout/set.timezone';
import { useDecisionModal } from '@gitroom/frontend/components/layout/new-modal';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  getPipelineScheduleWeek,
  minuteOfDayToTime,
  PIPELINE_DAYS,
} from '@gitroom/frontend/components/pipelines/pipeline.utils';
import {
  PipelineScheduleOccurrence,
} from '@gitroom/frontend/components/pipelines/pipeline.types';
import {
  pipelineGlobalScheduleKey,
  usePipelineGlobalSchedule,
} from '@gitroom/frontend/components/pipelines/use.pipeline.global.schedule';
import { useDeletePipelineScheduleSlot } from '@gitroom/frontend/components/pipelines/use.pipeline.schedule.slot.delete';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const formatDateHeader = (date: dayjs.Dayjs, timezone: string) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
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
  return `${scheduledFor} · ${occurrence.pipelineTimezone} · ${
    occurrence.active ? 'Active' : 'Paused'
  } · Source: ${sourceDay} ${minuteOfDayToTime(occurrence.minuteOfDay)}`;
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
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    setDisplayTimezone(getTimezone());
  }, []);

  const week = useMemo(
    () => (displayTimezone ? getPipelineScheduleWeek(displayTimezone) : undefined),
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

  const occurrencesByCell = useMemo(() => {
    const cells = new Map<string, PipelineScheduleOccurrence[]>();
    if (!data || !displayTimezone) {
      return cells;
    }
    for (const occurrence of data) {
      const localTime = dayjs(occurrence.scheduledFor).tz(displayTimezone);
      const key = `${localTime.format('YYYY-MM-DD')}:${localTime.hour()}`;
      cells.set(key, [...(cells.get(key) || []), occurrence]);
    }
    return cells;
  }, [data, displayTimezone]);

  const removeSlot = useCallback(
    async (occurrence: PipelineScheduleOccurrence) => {
      if (pendingOccurrenceIds.has(occurrence.id)) {
        return;
      }
      const day = PIPELINE_DAYS[occurrence.dayOfWeek]?.label;
      const sourceTime = minuteOfDayToTime(occurrence.minuteOfDay);
      const approved = await decision.open({
        title: t('remove_pipeline_schedule_slot', 'Remove Pipeline schedule slot?'),
        description: `Removing "${occurrence.pipelineName}" on ${day} at ${sourceTime} (${occurrence.pipelineTimezone}) will remove this recurring source slot from every future week.`,
        approveLabel: t('remove', 'Remove'),
        cancelLabel: t('cancel', 'Cancel'),
      });
      if (!approved) {
        return;
      }

      setDeleteError('');
      setPendingOccurrenceIds((current) => new Set(current).add(occurrence.id));
      try {
        await deleteScheduleSlot(occurrence.pipelineId, {
          dayOfWeek: occurrence.dayOfWeek,
          minuteOfDay: occurrence.minuteOfDay,
        });
        toaster.show(
          t('pipeline_schedule_slot_removed', 'Pipeline schedule slot removed.'),
          'success'
        );
      } catch (err: any) {
        const message =
          err?.message ||
          t(
            'pipeline_schedule_slot_remove_failed',
            'Failed to remove the Pipeline schedule slot. The schedule has been refreshed.'
          );
        setDeleteError(message);
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
    [
      decision,
      deleteScheduleSlot,
      mutate,
      pendingOccurrenceIds,
      t,
      toaster,
    ]
  );

  const today = displayTimezone
    ? dayjs().tz(displayTimezone).format('YYYY-MM-DD')
    : '';

  return (
    <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[20px] text-textColor">
      <div className="flex flex-col gap-[12px]">
        <Button secondary className="self-start" onClick={() => router.push('/pipelines')}>
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
              ? `${t('display_timezone', 'Display timezone')}: ${displayTimezone}`
              : t('loading_timezone', 'Loading selected timezone…')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-[12px] text-[13px]">
        <span className="font-[500]">{t('legend', 'Legend')}:</span>
        <span className="flex items-center gap-[6px]">
          <span className="h-[12px] w-[12px] rounded-[3px] bg-btnPrimary" />
          {t('active', 'Active')}
        </span>
        <span className="flex items-center gap-[6px] opacity-60">
          <span className="h-[12px] w-[12px] rounded-[3px] border border-newBorder bg-newBgColor" />
          {t('paused', 'Paused')}
        </span>
      </div>

      {deleteError && (
        <div className="rounded-[12px] border border-red-500/30 bg-newBgColor px-[16px] py-[12px] text-[14px] text-red-500">
          {deleteError}
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
        <div className="max-h-[calc(100vh-280px)] min-h-[420px] overflow-auto rounded-[10px] border border-newBorder bg-newBorder scrollbar scrollbar-thumb-newBorder scrollbar-track-newBgColor">
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
                <div className="sticky start-0 z-10 flex min-h-[76px] items-start justify-end bg-newBgColor px-[12px] pt-[10px] text-[13px] text-newTableText">
                  {formatHour(hour)}
                </div>
                {week!.days.map((date) => {
                  const cellOccurrences =
                    occurrencesByCell.get(
                      `${date.format('YYYY-MM-DD')}:${hour}`
                    ) || [];
                  return (
                    <div
                      key={`${date.format('YYYY-MM-DD')}-${hour}`}
                      className={clsx(
                        'flex min-h-[76px] flex-col gap-[4px] bg-newBgColor p-[6px]',
                        date.format('YYYY-MM-DD') === today && 'bg-newBgColorInner'
                      )}
                    >
                      {cellOccurrences.map((occurrence) => {
                        const pending = pendingOccurrenceIds.has(occurrence.id);
                        const sourceDay =
                          PIPELINE_DAYS[occurrence.dayOfWeek]?.label;
                        const sourceTime = minuteOfDayToTime(
                          occurrence.minuteOfDay
                        );
                        const details = formatOccurrenceDetails(
                          occurrence,
                          displayTimezone
                        );
                        return (
                          <div
                            key={occurrence.id}
                            title={details}
                            className={clsx(
                              'flex min-w-0 items-center justify-between gap-[4px] rounded-[6px] px-[7px] py-[5px] text-[12px]',
                              occurrence.active
                                ? 'bg-btnPrimary text-btnText'
                                : 'border border-newBorder bg-newBgColorInner text-textColor opacity-60'
                            )}
                          >
                            <span className="min-w-0 truncate" aria-label={`${occurrence.pipelineName}. ${details}`}>
                              {occurrence.pipelineName}
                            </span>
                            {!occurrence.active && (
                              <span className="shrink-0 rounded-[3px] border border-current px-[3px] py-[1px] text-[10px]">
                                {t('paused', 'Paused')}
                              </span>
                            )}
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => removeSlot(occurrence)}
                              className="shrink-0 rounded px-[3px] text-[16px] leading-none hover:bg-newBgColor/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-btnPrimary disabled:cursor-not-allowed"
                              aria-label={`${t('remove', 'Remove')} ${occurrence.pipelineName} ${sourceDay} ${sourceTime} ${t('pipeline_schedule_slot', 'Pipeline schedule slot')}`}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
