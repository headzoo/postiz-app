'use client';

import { FC, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Button } from '@gitroom/react/form/button';
import { Slider } from '@gitroom/react/form/slider';
import { useModals, useDecisionModal } from '@gitroom/frontend/components/layout/new-modal';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { PipelineChannels } from '@gitroom/frontend/components/pipelines/pipeline.channels';
import { PipelineForm } from '@gitroom/frontend/components/pipelines/pipeline.form';
import { PipelineQueue } from '@gitroom/frontend/components/pipelines/pipeline.queue';
import {
  formatPipelineSlot,
  minuteOfDayToTime,
  PIPELINE_DAYS,
} from '@gitroom/frontend/components/pipelines/pipeline.utils';
import { usePipelineDetail } from '@gitroom/frontend/components/pipelines/use.pipeline.detail';
import { usePipelineStatus } from '@gitroom/frontend/components/pipelines/use.pipeline.status';
import { useDeletePipeline } from '@gitroom/frontend/components/pipelines/use.pipeline.delete';
import { usePipelineList } from '@gitroom/frontend/components/pipelines/use.pipeline.list';

export const PipelineDetailView: FC<{ pipelineId: string }> = ({ pipelineId }) => {
  const t = useT();
  const router = useRouter();
  const modal = useModals();
  const decision = useDecisionModal();
  const toaster = useToaster();
  const { data, error, isLoading, mutate } = usePipelineDetail(pipelineId);
  const { data: pipelines, mutate: mutateList } = usePipelineList();
  const setPipelineStatus = usePipelineStatus();
  const deletePipeline = useDeletePipeline();
  const queueCount =
    data?.queueCount ??
    (data?.queueItems || []).filter((item) => item.status === 'QUEUED').length;

  const openEdit = useCallback(() => {
    if (!data) {
      return;
    }
    modal.openModal({
      title: t('edit_pipeline', 'Edit Pipeline'),
      withCloseButton: true,
      classNames: {
        modal: 'w-[100%] max-w-[760px] text-textColor',
      },
      children: (
        <PipelineForm
          pipeline={data}
          onSaved={() => {
            mutate();
            mutateList();
          }}
        />
      ),
    });
  }, [data, modal, mutate, mutateList, t]);

  const toggleActive = useCallback(
    async (value: 'on' | 'off') => {
      try {
        await setPipelineStatus(pipelineId, value === 'on');
        await Promise.all([mutate(), mutateList()]);
      } catch (err: any) {
        toaster.show(err?.message || 'Failed to update Pipeline status.', 'warning');
      }
    },
    [mutate, mutateList, pipelineId, setPipelineStatus, toaster]
  );

  const confirmDelete = useCallback(async () => {
    if (!data) {
      return;
    }
    const approved = await decision.open({
      title: t('delete_pipeline', 'Delete Pipeline?'),
      description: `Deleting "${data.name}" will remove the Pipeline schedule. ${queueCount} queued item${queueCount === 1 ? '' : 's'} will be preserved as drafts in your calendar — no content will be deleted.`,
      approveLabel: t('delete_pipeline_confirm', 'Delete Pipeline'),
      cancelLabel: t('cancel', 'Cancel'),
    });
    if (!approved) {
      return;
    }
    try {
      await deletePipeline(pipelineId);
      toaster.show(
        t('pipeline_deleted_successfully', 'Pipeline deleted. Queued posts were kept as drafts.'),
        'success'
      );
      router.push('/pipelines');
    } catch (err: any) {
      toaster.show(err?.message || 'Failed to delete Pipeline.', 'warning');
    }
  }, [data, decision, deletePipeline, pipelineId, queueCount, router, t, toaster]);

  if (isLoading) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[15px] transition-all items-center justify-center">
        <LoadingComponent />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[15px] text-textColor">
        <div className="rounded-[12px] border border-red-500/30 px-[16px] py-[12px] text-red-500">
          {t('pipeline_not_found', 'Pipeline not found.')}
        </div>
        <Button onClick={() => router.push('/pipelines')}>
          {t('back_to_pipelines', 'Back to Pipelines')}
        </Button>
      </div>
    );
  }

  const slotsByDay = PIPELINE_DAYS.map((day) => ({
    ...day,
    times: (data.scheduleSlots || [])
      .filter((slot) => slot.dayOfWeek === day.dayOfWeek)
      .map((slot) => minuteOfDayToTime(slot.minuteOfDay)),
  }));

  return (
    <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[20px] transition-all text-textColor">
      <div className="flex flex-col gap-[12px] lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-[8px]">
          <Button secondary onClick={() => router.push('/pipelines')}>
            {t('back_to_pipelines', 'Back to Pipelines')}
          </Button>
          <h1 className="text-[24px] font-[600]">{data.name}</h1>
          <div className="text-[14px] opacity-70">
            {t('timezone', 'Timezone')}: {data.timezone}
          </div>
          <span
            className={clsx(
              'inline-flex w-fit text-[12px] px-[8px] py-[2px] rounded-full border',
              data.active
                ? 'border-green-500/40 text-green-500'
                : 'border-newBorder opacity-70'
            )}
          >
            {data.active ? t('active', 'Active') : t('paused', 'Paused')}
          </span>
        </div>
        <div className="flex items-center gap-[10px] flex-wrap">
          <Button onClick={openEdit}>{t('edit', 'Edit')}</Button>
          <Button secondary onClick={confirmDelete}>
            {t('delete', 'Delete')}
          </Button>
          <div className="flex items-center gap-[8px] px-[8px]">
            <span className="text-[12px] opacity-70">
              {data.active ? t('pause', 'Pause') : t('resume', 'Resume')}
            </span>
            <Slider
              value={data.active ? 'on' : 'off'}
              onChange={toggleActive}
              fill={true}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-[12px]">
        <div className="rounded-[12px] border border-newBorder bg-newBgColor p-[16px] flex flex-col gap-[8px]">
          <div className="text-[12px] uppercase opacity-60">{t('channels', 'Channels')}</div>
          <PipelineChannels channels={data.channels} />
        </div>
        <div className="rounded-[12px] border border-newBorder bg-newBgColor p-[16px] flex flex-col gap-[8px]">
          <div className="text-[12px] uppercase opacity-60">{t('queued', 'Queued')}</div>
          <div className="text-[24px] font-[600]">{queueCount}</div>
        </div>
        <div className="rounded-[12px] border border-newBorder bg-newBgColor p-[16px] flex flex-col gap-[8px]">
          <div className="text-[12px] uppercase opacity-60">{t('next_slot', 'Next slot')}</div>
          <div className="text-[14px]">
            {data.active
              ? formatPipelineSlot(data.nextSlot, data.timezone)
              : t('pipeline_paused', 'Paused')}
          </div>
        </div>
      </div>

      <div className="rounded-[12px] border border-newBorder bg-newBgColor overflow-hidden">
        <div className="px-[20px] py-[14px] border-b border-newBorder text-[16px] font-[600]">
          {t('weekly_schedule', 'Weekly schedule')}
        </div>
        <div className="p-[16px] grid grid-cols-1 md:grid-cols-2 gap-[12px]">
          {slotsByDay.map((day) => (
            <div
              key={day.dayOfWeek}
              className="rounded-[8px] border border-newBorder bg-newBgColorInner p-[12px]"
            >
              <div className="text-[14px] font-[600] mb-[8px]">{day.label}</div>
              {day.times.length ? (
                <div className="flex flex-wrap gap-[8px]">
                  {day.times.map((time) => (
                    <span
                      key={`${day.dayOfWeek}-${time}`}
                      className="text-[13px] px-[10px] py-[4px] rounded-[8px] border border-newBorder"
                    >
                      {time}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[13px] opacity-60">—</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <PipelineQueue pipeline={data} pipelines={pipelines || []} mutate={mutate} />
    </div>
  );
};
