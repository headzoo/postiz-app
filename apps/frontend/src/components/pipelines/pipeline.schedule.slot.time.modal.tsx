'use client';

import { FC, useMemo, useState } from 'react';
import { Button } from '@gitroom/react/form/button';
import { Select } from '@gitroom/react/form/select';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { PipelineScheduleSlot } from '@gitroom/frontend/components/pipelines/pipeline.types';
import { minuteOfDayToTime } from '@gitroom/frontend/components/pipelines/pipeline.utils';

const MINUTES = [...Array(60).keys()].map((value) => ({ value }));

export const PipelineScheduleSlotTimeModal: FC<{
  slot: PipelineScheduleSlot;
  dayLabel: string;
  occupiedMinuteOfDays: number[];
  onApply: (newMinuteOfDay: number) => void;
}> = ({ slot, dayLabel, occupiedMinuteOfDays, onApply }) => {
  const t = useT();
  const modal = useModals();
  const hour = Math.floor(slot.minuteOfDay / 60);
  const [minute, setMinute] = useState(slot.minuteOfDay % 60);

  const newMinuteOfDay = hour * 60 + minute;
  const isUnchanged = newMinuteOfDay === slot.minuteOfDay;
  const isDuplicate = useMemo(
    () =>
      !isUnchanged &&
      occupiedMinuteOfDays.some(
        (occupiedMinuteOfDay) => occupiedMinuteOfDay === newMinuteOfDay
      ),
    [isUnchanged, occupiedMinuteOfDays, newMinuteOfDay]
  );

  const hourLabel = String(hour).padStart(2, '0');

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="text-[13px] opacity-70">
        {t(
          'pipeline_schedule_slot_time_hint',
          'Pick a more specific minute within this hour. Times use the Pipeline timezone.'
        )}
      </div>
      <div className="text-[14px] font-[500] text-textColor">
        {dayLabel} · {minuteOfDayToTime(slot.minuteOfDay)}
      </div>
      <div className="flex gap-[12px] items-end">
        <div className="flex-1">
          <div className="flex flex-col gap-[6px]">
            <div className="text-[14px]">{t('hour', 'Hour')}</div>
            <div className="flex h-[42px] items-center rounded-[8px] border border-newBorder bg-newBgColorInner px-[12px] text-[14px] text-textColor tabular-nums">
              {hourLabel}
            </div>
          </div>
        </div>
        <div className="flex-1">
          <Select
            label={t('minutes', 'Minutes')}
            name="minutes"
            disableForm={true}
            hideErrors={true}
            value={minute}
            onChange={(event) => setMinute(Number(event.target.value))}
          >
            {MINUTES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {String(entry.value).padStart(2, '0')}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {isDuplicate && (
        <div className="rounded-[8px] border border-red-500/30 px-[12px] py-[8px] text-[13px] text-red-500">
          {t(
            'pipeline_schedule_slot_time_duplicate',
            'A slot already exists at this time for this day.'
          )}
        </div>
      )}
      <div className="flex justify-end gap-[10px]">
        <Button type="button" secondary onClick={() => modal.closeCurrent()}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          disabled={isDuplicate || isUnchanged}
          onClick={() => {
            onApply(newMinuteOfDay);
            modal.closeCurrent();
          }}
        >
          {t('apply', 'Apply')}
        </Button>
      </div>
    </div>
  );
};
