'use client';

import { FC, Fragment, MouseEvent, useCallback } from 'react';
import clsx from 'clsx';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { PipelineScheduleSlot } from '@gitroom/frontend/components/pipelines/pipeline.types';
import { PipelineScheduleSlotTimeModal } from '@gitroom/frontend/components/pipelines/pipeline.schedule.slot.time.modal';
import {
  minuteOfDayToTime,
  PIPELINE_DAYS,
} from '@gitroom/frontend/components/pipelines/pipeline.utils';

const SlotPill: FC<{
  dayLabel: string;
  slot: PipelineScheduleSlot;
  onEdit: (slot: PipelineScheduleSlot, dayLabel: string) => void;
  onRemove: (slot: PipelineScheduleSlot) => void;
}> = ({ dayLabel, slot, onEdit, onRemove }) => {
  const timeLabel = minuteOfDayToTime(slot.minuteOfDay);

  return (
    <div className="flex items-center justify-between gap-[4px] rounded-[6px] bg-btnPrimary px-[7px] py-[4px] text-[12px] text-btnText">
      <button
        type="button"
        className="min-w-0 flex-1 cursor-pointer rounded text-start hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-btnText"
        aria-label={`Edit ${dayLabel} ${timeLabel} slot`}
        onClick={() => onEdit(slot, dayLabel)}
      >
        {timeLabel}
      </button>
      <button
        type="button"
        className="inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded hover:bg-newBgColor focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-btnText"
        aria-label={`Remove ${dayLabel} ${timeLabel} slot`}
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          onRemove(slot);
        }}
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

const AddZone: FC<{
  ariaLabel: string;
  onClick: () => void;
}> = ({ ariaLabel, onClick }) => (
  <div className="flex min-h-[28px] flex-1 items-center justify-center">
    <button
      type="button"
      className={clsx(
        'flex h-[28px] w-[28px] items-center justify-center rounded-[6px] border border-newBorder bg-newBgColorInner text-newTableText opacity-0 transition-opacity hover:bg-btnPrimary hover:text-btnText focus:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-btnPrimary',
        'group-hover:opacity-100'
      )}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <svg
        viewBox="0 0 12 12"
        className="h-[12px] w-[12px]"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M6 2v8M2 6h8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  </div>
);

export const PipelineScheduleEditor: FC<{
  value: PipelineScheduleSlot[];
  onChange: (value: PipelineScheduleSlot[]) => void;
}> = ({ value, onChange }) => {
  const t = useT();
  const modal = useModals();

  const addSlot = (dayOfWeek: number, minuteOfDay: number) => {
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

  const updateSlotTime = useCallback(
    (oldSlot: PipelineScheduleSlot, newMinuteOfDay: number) => {
      if (oldSlot.minuteOfDay === newMinuteOfDay) {
        return;
      }
      const hasDuplicate = value.some(
        (slot) =>
          slot.dayOfWeek === oldSlot.dayOfWeek &&
          slot.minuteOfDay === newMinuteOfDay
      );
      if (hasDuplicate) {
        return;
      }
      onChange([
        ...value.filter(
          (slot) =>
            slot.dayOfWeek !== oldSlot.dayOfWeek ||
            slot.minuteOfDay !== oldSlot.minuteOfDay
        ),
        { dayOfWeek: oldSlot.dayOfWeek, minuteOfDay: newMinuteOfDay },
      ]);
    },
    [onChange, value]
  );

  const openSlotTimeModal = useCallback(
    (slot: PipelineScheduleSlot, dayLabel: string) => {
      const occupiedMinuteOfDays = value
        .filter(
          (entry) =>
            entry.dayOfWeek === slot.dayOfWeek &&
            entry.minuteOfDay !== slot.minuteOfDay
        )
        .map((entry) => entry.minuteOfDay);

      modal.openModal({
        title: t('edit_slot_time', 'Edit slot time'),
        withCloseButton: true,
        classNames: {
          modal: 'w-[100%] max-w-[360px] text-textColor',
        },
        children: (
          <PipelineScheduleSlotTimeModal
            slot={slot}
            dayLabel={dayLabel}
            occupiedMinuteOfDays={occupiedMinuteOfDays}
            onApply={(newMinuteOfDay) =>
              updateSlotTime(slot, newMinuteOfDay)
            }
          />
        ),
      });
    },
    [modal, t, updateSlotTime, value]
  );

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="text-[13px] opacity-70">
        Add slots by hour, then click a slot to set a specific minute. After
        adding the top of an hour, you can add a second slot at the half hour.
        Existing off-hour slots are retained and can be removed. Times use the
        Pipeline timezone.
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
                const topMinute = hour * 60;
                const halfMinute = hour * 60 + 30;
                const slots = value
                  .filter(
                    (slot) =>
                      slot.dayOfWeek === day.dayOfWeek &&
                      Math.floor(slot.minuteOfDay / 60) === hour
                  )
                  .sort((left, right) => left.minuteOfDay - right.minuteOfDay);
                const topSlot = slots.find(
                  (slot) => slot.minuteOfDay === topMinute
                );
                const halfSlot = slots.find(
                  (slot) => slot.minuteOfDay === halfMinute
                );
                const offHourSlots = slots.filter(
                  (slot) =>
                    slot.minuteOfDay !== topMinute &&
                    slot.minuteOfDay !== halfMinute
                );
                const hourLabel = String(hour).padStart(2, '0');
                return (
                  <div
                    key={`${day.dayOfWeek}-${hour}`}
                    className="group relative flex min-h-[64px] flex-col gap-[4px] bg-newBgColor p-[6px]"
                  >
                    {offHourSlots.map((slot) => (
                      <SlotPill
                        key={`${slot.dayOfWeek}-${slot.minuteOfDay}`}
                        dayLabel={day.label}
                        slot={slot}
                        onEdit={openSlotTimeModal}
                        onRemove={removeSlot}
                      />
                    ))}
                    {topSlot ? (
                      <SlotPill
                        dayLabel={day.label}
                        slot={topSlot}
                        onEdit={openSlotTimeModal}
                        onRemove={removeSlot}
                      />
                    ) : (
                      <AddZone
                        ariaLabel={`Add ${day.label} ${hourLabel}:00 slot`}
                        onClick={() => addSlot(day.dayOfWeek, topMinute)}
                      />
                    )}
                    {halfSlot ? (
                      <SlotPill
                        dayLabel={day.label}
                        slot={halfSlot}
                        onEdit={openSlotTimeModal}
                        onRemove={removeSlot}
                      />
                    ) : (
                      topSlot && (
                        <AddZone
                          ariaLabel={`Add ${day.label} ${hourLabel}:30 slot`}
                          onClick={() => addSlot(day.dayOfWeek, halfMinute)}
                        />
                      )
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
