'use client';

import { FC, Fragment } from 'react';
import clsx from 'clsx';
import { PipelineScheduleSlot } from '@gitroom/frontend/components/pipelines/pipeline.types';
import {
  minuteOfDayToTime,
  PIPELINE_DAYS,
} from '@gitroom/frontend/components/pipelines/pipeline.utils';

export const PipelineScheduleEditor: FC<{
  value: PipelineScheduleSlot[];
  onChange: (value: PipelineScheduleSlot[]) => void;
}> = ({ value, onChange }) => {
  const addSlot = (dayOfWeek: number, hour: number) => {
    const minuteOfDay = hour * 60;
    if (
      value.some(
        (slot) =>
          slot.dayOfWeek === dayOfWeek && slot.minuteOfDay === minuteOfDay
      )
    ) {
      return;
    }
    onChange([...value, { dayOfWeek, minuteOfDay }]);
  };

  const removeSlot = (slotToRemove: PipelineScheduleSlot) => {
    onChange(
      value.filter(
        (slot) =>
          slot.dayOfWeek !== slotToRemove.dayOfWeek ||
          slot.minuteOfDay !== slotToRemove.minuteOfDay
      )
    );
  };

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="text-[13px] opacity-70">
        Add hourly slots for this Pipeline. Existing off-hour slots are retained
        and can be removed. Times use the Pipeline timezone.
      </div>
      <div className="max-h-[640px] overflow-auto rounded-[10px] border border-newBorder bg-newBorder scrollbar scrollbar-thumb-newBorder scrollbar-track-newBgColor">
        <div className="grid min-w-[1004px] grid-cols-[80px_repeat(7,_minmax(132px,_1fr))] gap-px">
          <div className="sticky start-0 top-0 z-30 h-[62px] bg-newTableHeader" />
          {PIPELINE_DAYS.map((day) => (
            <div
              key={day.dayOfWeek}
              className="sticky top-0 z-20 flex h-[62px] items-center justify-center bg-newTableHeader px-[8px] text-center text-[14px] font-[500] text-newTableText"
            >
              {day.label}
            </div>
          ))}
          {Array.from({ length: 24 }, (_, hour) => (
            <Fragment key={hour}>
              <div className="sticky start-0 z-10 flex min-h-[64px] items-start justify-end bg-newBgColor px-[12px] pt-[10px] text-[13px] text-newTableText">
                {String(hour).padStart(2, '0')}:00
              </div>
              {PIPELINE_DAYS.map((day) => {
                const slots = value
                  .filter(
                    (slot) =>
                      slot.dayOfWeek === day.dayOfWeek &&
                      Math.floor(slot.minuteOfDay / 60) === hour
                  )
                  .sort((left, right) => left.minuteOfDay - right.minuteOfDay);
                const hasTopOfHourSlot = slots.some(
                  (slot) => slot.minuteOfDay === hour * 60
                );
                return (
                  <div
                    key={`${day.dayOfWeek}-${hour}`}
                    className="group relative flex min-h-[64px] flex-col gap-[4px] bg-newBgColor p-[6px]"
                  >
                    {slots.map((slot) => (
                      <div
                        key={`${slot.dayOfWeek}-${slot.minuteOfDay}`}
                        className="flex items-center justify-between gap-[4px] rounded-[6px] bg-btnPrimary px-[7px] py-[4px] text-[12px] text-btnText"
                      >
                        <span>{minuteOfDayToTime(slot.minuteOfDay)}</span>
                        <button
                          type="button"
                          className="rounded px-[3px] text-[14px] leading-none hover:bg-newBgColor focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-btnText"
                          aria-label={`Remove ${day.label} ${minuteOfDayToTime(slot.minuteOfDay)} slot`}
                          onClick={() => removeSlot(slot)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {!hasTopOfHourSlot && (
                      <button
                        type="button"
                        className={clsx(
                          'flex h-[28px] w-[28px] items-center justify-center self-center rounded-[6px] border border-newBorder bg-newBgColorInner text-[18px] text-newTableText opacity-0 transition-opacity hover:bg-btnPrimary hover:text-btnText focus:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-btnPrimary',
                          'group-hover:opacity-100'
                        )}
                        aria-label={`Add ${day.label} ${String(hour).padStart(2, '0')}:00 slot`}
                        onClick={() => addSlot(day.dayOfWeek, hour)}
                      >
                        +
                      </button>
                    )}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
