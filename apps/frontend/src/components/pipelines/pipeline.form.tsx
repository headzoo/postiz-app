'use client';

import { FC, useCallback, useMemo, useState } from 'react';
import timezones from 'timezones-list';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { Select } from '@gitroom/react/form/select';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { PickPlatforms } from '@gitroom/frontend/components/launches/helpers/pick.platform.component';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import { Integrations } from '@gitroom/frontend/components/launches/calendar.context';
import { PipelineDetail } from '@gitroom/frontend/components/pipelines/pipeline.types';
import { PipelineScheduleEditor } from '@gitroom/frontend/components/pipelines/pipeline.schedule.editor';
import {
  dayTimesToSlots,
  slotsToDayTimes,
} from '@gitroom/frontend/components/pipelines/pipeline.utils';
import { useCreatePipeline } from '@gitroom/frontend/components/pipelines/use.pipeline.create';
import { useUpdatePipeline } from '@gitroom/frontend/components/pipelines/use.pipeline.update';

dayjs.extend(timezone);

const defaultDayTimes = (): Record<number, string[]> => ({
  0: [],
  1: ['09:00'],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [],
});

export const PipelineForm: FC<{
  pipeline?: PipelineDetail;
  onSaved: () => void;
}> = ({ pipeline, onSaved }) => {
  const t = useT();
  const modal = useModals();
  const toaster = useToaster();
  const createPipeline = useCreatePipeline();
  const updatePipeline = useUpdatePipeline();
  const { data: integrations = [], isLoading } = useIntegrationList();

  const [name, setName] = useState(pipeline?.name || '');
  const [timezoneValue, setTimezoneValue] = useState(
    pipeline?.timezone || dayjs.tz.guess()
  );
  const [selectedIntegrations, setSelectedIntegrations] = useState<Integrations[]>(
    pipeline?.channels?.map((channel) => ({ ...channel })) || []
  );
  const [dayTimes, setDayTimes] = useState<Record<number, string[]>>(
    pipeline?.scheduleSlots?.length
      ? slotsToDayTimes(pipeline.scheduleSlots)
      : defaultDayTimes()
  );
  const [scheduleError, setScheduleError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const enabledIntegrations = useMemo(
    () => integrations.filter((integration: Integrations) => !integration.disabled),
    [integrations]
  );

  const validate = useCallback(() => {
    if (!name.trim()) {
      setFormError('Pipeline name is required.');
      return false;
    }
    if (!timezoneValue) {
      setFormError('Pipeline timezone is required.');
      return false;
    }
    if (!selectedIntegrations.length) {
      setFormError('Select at least one channel for this Pipeline.');
      return false;
    }
    const scheduleSlots = dayTimesToSlots(dayTimes);
    if (!scheduleSlots.length) {
      setScheduleError('Add at least one posting time.');
      setFormError('Add at least one posting time.');
      return false;
    }
    setScheduleError('');
    setFormError('');
    return true;
  }, [dayTimes, name, selectedIntegrations.length, timezoneValue]);

  const submit = useCallback(async () => {
    if (!validate()) {
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        timezone: timezoneValue,
        integrations: selectedIntegrations.map((integration) => ({
          id: integration.id,
        })),
        scheduleSlots: dayTimesToSlots(dayTimes),
      };
      if (pipeline?.id) {
        await updatePipeline(pipeline.id, payload);
        toaster.show(
          t('pipeline_updated_successfully', 'Pipeline updated successfully'),
          'success'
        );
      } else {
        await createPipeline(payload);
        toaster.show(
          t('pipeline_created_successfully', 'Pipeline created successfully'),
          'success'
        );
      }
      modal.closeAll();
      onSaved();
    } catch (error: any) {
      setFormError(error?.message || 'Failed to save Pipeline.');
      toaster.show(error?.message || 'Failed to save Pipeline.', 'warning');
    } finally {
      setSaving(false);
    }
  }, [
    createPipeline,
    dayTimes,
    modal,
    name,
    onSaved,
    pipeline?.id,
    selectedIntegrations,
    t,
    timezoneValue,
    toaster,
    updatePipeline,
    validate,
  ]);

  return (
    <div className="flex flex-col gap-[20px] max-h-[75vh] overflow-y-auto pe-[4px]">
      {formError && (
        <div className="text-[13px] text-red-500 border border-red-500/30 rounded-[8px] px-[12px] py-[8px]">
          {formError}
        </div>
      )}
      <Input
        name="name"
        label="Pipeline name"
        translationKey="label_pipeline_name"
        disableForm={true}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Weekly product updates"
      />
      <Select
        name="timezone"
        label="Timezone"
        translationKey="label_pipeline_timezone"
        disableForm={true}
        value={timezoneValue}
        onChange={(event) => setTimezoneValue(event.target.value)}
      >
        {timezones.map((zone) => (
          <option key={zone.tzCode} value={zone.tzCode}>
            {zone.label}
          </option>
        ))}
      </Select>
      <div className="flex flex-col gap-[8px]">
        <div className="text-[14px] font-[600] text-textColor">Channels</div>
        <div className="text-[13px] opacity-70">
          Queued posts use exactly these channels. Changing channels may be blocked
          while items are queued.
        </div>
        {!isLoading && !!enabledIntegrations.length && (
          <PickPlatforms
            integrations={enabledIntegrations}
            selectedIntegrations={selectedIntegrations}
            onChange={(next) => setSelectedIntegrations(next)}
            singleSelect={false}
            toolTip={true}
            isMain={true}
          />
        )}
        {!isLoading && !enabledIntegrations.length && (
          <div className="text-[13px] opacity-70">
            Connect channels before creating a Pipeline.
          </div>
        )}
      </div>
      <PipelineScheduleEditor
        value={dayTimes}
        onChange={setDayTimes}
        error={scheduleError}
      />
      <div className="flex gap-[10px] justify-end sticky bottom-0 bg-newBgColorInner pt-[12px]">
        <Button type="button" secondary onClick={() => modal.closeAll()}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button type="button" onClick={submit} disabled={saving || isLoading}>
          {saving ? t('saving', 'Saving...') : t('save', 'Save')}
        </Button>
      </div>
    </div>
  );
};
