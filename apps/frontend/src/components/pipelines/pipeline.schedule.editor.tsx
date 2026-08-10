'use client';

import { FC } from 'react';
import clsx from 'clsx';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { PIPELINE_DAYS } from '@gitroom/frontend/components/pipelines/pipeline.utils';

export const PipelineScheduleEditor: FC<{
  value: Record<number, string[]>;
  onChange: (value: Record<number, string[]>) => void;
  error?: string;
}> = ({ value, onChange, error }) => {
  const addSlot = (dayOfWeek: number) => {
    onChange({
      ...value,
      [dayOfWeek]: [...(value[dayOfWeek] || []), '09:00'],
    });
  };

  const removeSlot = (dayOfWeek: number, index: number) => {
    onChange({
      ...value,
      [dayOfWeek]: (value[dayOfWeek] || []).filter((_, i) => i !== index),
    });
  };

  const updateSlot = (dayOfWeek: number, index: number, time: string) => {
    const next = [...(value[dayOfWeek] || [])];
    next[index] = time;
    onChange({
      ...value,
      [dayOfWeek]: next,
    });
  };

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="text-[14px] font-[600] text-textColor">Weekly schedule</div>
      <div className="text-[13px] opacity-70">
        Add one or more posting times for each day. Times use the Pipeline timezone.
      </div>
      {error && (
        <div className="text-[13px] text-red-500 border border-red-500/30 rounded-[8px] px-[12px] py-[8px]">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-[10px]">
        {PIPELINE_DAYS.map((day) => {
          const slots = value[day.dayOfWeek] || [];
          return (
            <div
              key={day.dayOfWeek}
              className="rounded-[12px] border border-newBorder bg-newBgColor p-[12px] flex flex-col gap-[10px]"
            >
              <div className="flex items-center justify-between gap-[12px]">
                <div className="text-[14px] font-[600] text-textColor">
                  {day.label}
                </div>
                <Button type="button" secondary onClick={() => addSlot(day.dayOfWeek)}>
                  Add time
                </Button>
              </div>
              {!slots.length && (
                <div className="text-[13px] opacity-60">No times configured</div>
              )}
              <div className="flex flex-col gap-[8px]">
                {slots.map((time, index) => (
                  <div
                    key={`${day.dayOfWeek}-${index}`}
                    className="flex items-center gap-[10px]"
                  >
                    <Input
                      name={`schedule-${day.dayOfWeek}-${index}`}
                      label=""
                      type="time"
                      disableForm={true}
                      value={time}
                      onChange={(event) =>
                        updateSlot(day.dayOfWeek, index, event.target.value)
                      }
                      className={clsx(
                        'bg-newBgColorInner border border-newBorder rounded-[8px] h-[40px] px-[12px] text-textColor outline-none'
                      )}
                    />
                    <Button
                      type="button"
                      secondary
                      onClick={() => removeSlot(day.dayOfWeek, index)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
