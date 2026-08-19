'use client';

import React, { FC, useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Button } from '@gitroom/react/form/button';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

type ScheduleUnit = 'hour' | 'day' | 'month';

interface ScheduleCadence {
  unit: ScheduleUnit;
  interval: number;
  timeOfDay?: string;
  dayOfMonth?: number;
}

interface ScheduleResponse {
  scheduleId: string;
  exists: boolean;
  paused: boolean;
  cadence: ScheduleCadence;
  nextRunTimes: string[];
  note?: string;
}

const useRelationshipGradeSchedule = () => {
  const fetch = useFetch();
  return useSWR<ScheduleResponse>(
    '/admin/schedule/relationship-grades',
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to load schedule');
      }
      return res.json();
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );
};

const formatCadence = (cadence: ScheduleCadence) => {
  if (cadence.unit === 'hour') {
    return cadence.interval === 1
      ? 'Every hour'
      : `Every ${cadence.interval} hours`;
  }
  if (cadence.unit === 'day') {
    const time = cadence.timeOfDay || '00:00';
    return cadence.interval === 1
      ? `Every day at ${time} UTC`
      : `Every ${cadence.interval} days at ${time} UTC`;
  }
  const time = cadence.timeOfDay || '00:00';
  return `Every ${cadence.interval} month(s) on day ${cadence.dayOfMonth || 1} at ${time} UTC`;
};

export const AdminScheduleComponent: FC = () => {
  const user = useUser();
  const t = useT();
  const fetch = useFetch();
  const { data, isLoading, error, mutate } = useRelationshipGradeSchedule();
  const [unit, setUnit] = useState<ScheduleUnit>('day');
  const [interval, setInterval] = useState(3);
  const [timeOfDay, setTimeOfDay] = useState('00:00');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!data?.cadence) {
      return;
    }
    setUnit(data.cadence.unit);
    setInterval(data.cadence.interval);
    setTimeOfDay(data.cadence.timeOfDay || '00:00');
    setDayOfMonth(data.cadence.dayOfMonth || 1);
  }, [data]);

  const save = useCallback(async () => {
    setFormError('');
    setSaving(true);
    try {
      const res = await fetch('/admin/schedule/relationship-grades', {
        method: 'PUT',
        body: JSON.stringify({
          unit,
          interval,
          ...(unit === 'hour' ? {} : { timeOfDay }),
          ...(unit === 'month' ? { dayOfMonth } : {}),
        }),
      });
      if (!res.ok) {
        throw new Error('Failed to save schedule');
      }
      await mutate(await res.json(), false);
    } catch {
      setFormError(
        t('admin_schedule_save_error', 'Could not save this schedule. Try again.')
      );
    } finally {
      setSaving(false);
    }
  }, [dayOfMonth, fetch, interval, mutate, t, timeOfDay, unit]);

  const trigger = useCallback(async () => {
    setFormError('');
    setTriggering(true);
    try {
      const res = await fetch('/admin/schedule/relationship-grades/trigger', {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Failed to trigger schedule');
      }
      await mutate(await res.json(), false);
    } catch {
      setFormError(
        t(
          'admin_schedule_trigger_error',
          'Could not trigger a grade update. Try again.'
        )
      );
    } finally {
      setTriggering(false);
    }
  }, [fetch, mutate, t]);

  if (!user?.isSuperAdmin) {
    return (
      <div className="text-textColor p-[20px]">
        {t('no_access', 'You do not have access to this page.')}
      </div>
    );
  }

  if (isLoading) {
    return <LoadingComponent />;
  }

  if (error) {
    return (
      <div className="text-red-400">
        {t('admin_schedule_load_error', 'Failed to load schedule.')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[16px] text-textColor">
      <div className="text-[20px] font-[600]">
        {t('admin_schedule', 'Schedule')}
      </div>
      <p className="text-[14px] opacity-70">
        {t(
          'admin_schedule_grade_help',
          'Choose how often Temporal updates relationship grades. Hourly is the most frequent option.'
        )}
      </p>

      <div className="border border-newTableBorder rounded-[8px] p-[16px] bg-newBgColorInner flex flex-col gap-[12px]">
        <div className="text-[16px] font-[600]">
          {t('admin_schedule_grade_title', 'Relationship grades')}
        </div>
        <div className="text-[13px] opacity-70">
          {data?.exists
            ? t('admin_schedule_active', 'Temporal schedule is active.')
            : t(
              'admin_schedule_missing',
              'No Temporal schedule exists yet. Saving will create one.'
            )}
        </div>
        {data?.cadence ? (
          <div className="text-[13px]">
            {formatCadence(data.cadence)}
          </div>
        ) : null}
        {data?.nextRunTimes?.length ? (
          <div className="text-[13px]">
            {t('admin_schedule_next_run', 'Next run')}:{' '}
            {new Date(data.nextRunTimes[0]).toLocaleString()}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-[12px] items-end">
          <label className="flex flex-col gap-[6px] min-w-[160px]" htmlFor="admin-schedule-repeat">
            <span className="text-[12px] opacity-70">
              {t('admin_schedule_repeat', 'Repeat')}
            </span>
            <select
              id="admin-schedule-repeat"
              value={unit}
              onChange={(event) => setUnit(event.target.value as ScheduleUnit)}
              className="bg-newBgColorInner h-[38px] border border-newTableBorder rounded-[8px] px-[10px] text-[14px] text-textColor"
            >
              <option value="hour">
                {t('admin_schedule_every_hour', 'Every hour')}
              </option>
              <option value="day">
                {t('admin_schedule_every_x_days', 'Every X days')}
              </option>
              <option value="month">
                {t('admin_schedule_every_month', 'Every month')}
              </option>
            </select>
          </label>
          <label className="flex flex-col gap-[6px] w-[120px]" htmlFor="admin-schedule-interval">
            <span className="text-[12px] opacity-70">
              {t('admin_schedule_interval', 'Interval')}
            </span>
            <input
              id="admin-schedule-interval"
              type="number"
              min={1}
              max={unit === 'hour' ? 168 : unit === 'day' ? 30 : 12}
              value={interval}
              onChange={(event) => setInterval(Number(event.target.value))}
              className="bg-newBgColorInner h-[38px] border border-newTableBorder rounded-[8px] px-[10px] text-[14px] text-textColor"
            />
          </label>
          {unit !== 'hour' && (
            <label className="flex flex-col gap-[6px] w-[140px]">
              <span className="text-[12px] opacity-70">
                {t('admin_schedule_time_utc', 'Time (UTC)')}
              </span>
              <input
                type="time"
                value={timeOfDay}
                onChange={(event) => setTimeOfDay(event.target.value)}
                className="bg-newBgColorInner h-[38px] border border-newTableBorder rounded-[8px] px-[10px] text-[14px] text-textColor"
              />
            </label>
          )}
          {unit === 'month' && (
            <label className="flex flex-col gap-[6px] w-[140px]">
              <span className="text-[12px] opacity-70">
                {t('admin_schedule_day_of_month', 'Day of month')}
              </span>
              <input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(event) => setDayOfMonth(Number(event.target.value))}
                className="bg-newBgColorInner h-[38px] border border-newTableBorder rounded-[8px] px-[10px] text-[14px] text-textColor"
              />
            </label>
          )}
        </div>

        {formError && <div className="text-[13px] text-red-400">{formError}</div>}

        <div className="flex flex-wrap gap-[12px]">
          <Button disabled={saving} onClick={save}>
            {t('save', 'Save')}
          </Button>
          <Button secondary disabled={triggering} onClick={trigger}>
            {t('admin_schedule_trigger_now', 'Trigger now')}
          </Button>
        </div>
      </div>
    </div>
  );
};
