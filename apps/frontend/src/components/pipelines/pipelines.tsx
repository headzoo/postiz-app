'use client';

import { FC, useCallback, useState } from 'react';
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
import { formatPipelineSlot } from '@gitroom/frontend/components/pipelines/pipeline.utils';
import { usePipelineList } from '@gitroom/frontend/components/pipelines/use.pipeline.list';
import { usePipelineDetail } from '@gitroom/frontend/components/pipelines/use.pipeline.detail';
import { usePipelineStatus } from '@gitroom/frontend/components/pipelines/use.pipeline.status';
import { useDeletePipeline } from '@gitroom/frontend/components/pipelines/use.pipeline.delete';
import { PipelineSummary } from '@gitroom/frontend/components/pipelines/pipeline.types';

const PipelineEditModal: FC<{
  pipelineId: string;
  onSaved: () => void;
}> = ({ pipelineId, onSaved }) => {
  const { data, isLoading, error } = usePipelineDetail(pipelineId);

  if (isLoading) {
    return <LoadingComponent height={60} width={60} />;
  }

  if (error || !data) {
    return (
      <div className="text-[14px] text-red-500">
        Failed to load Pipeline settings.
      </div>
    );
  }

  return <PipelineForm pipeline={data} onSaved={onSaved} />;
};

export const Pipelines: FC = () => {
  const t = useT();
  const router = useRouter();
  const modal = useModals();
  const decision = useDecisionModal();
  const toaster = useToaster();
  const { data, error, isLoading, mutate } = usePipelineList();
  const setPipelineStatus = usePipelineStatus();
  const deletePipeline = useDeletePipeline();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const openCreate = useCallback(() => {
    modal.openModal({
      title: t('create_pipeline', 'Create Pipeline'),
      withCloseButton: true,
      classNames: {
        modal: 'w-[100%] max-w-[760px] text-textColor',
      },
      children: <PipelineForm onSaved={() => mutate()} />,
    });
  }, [modal, mutate, t]);

  const openEdit = useCallback(
    (pipeline: PipelineSummary) => {
      modal.openModal({
        title: t('edit_pipeline', 'Edit Pipeline'),
        withCloseButton: true,
        classNames: {
          modal: 'w-[100%] max-w-[760px] text-textColor',
        },
        children: <PipelineEditModal pipelineId={pipeline.id} onSaved={() => mutate()} />,
      });
    },
    [modal, mutate, t]
  );

  const toggleActive = useCallback(
    (pipeline: PipelineSummary) => async (value: 'on' | 'off') => {
      setPendingId(pipeline.id);
      try {
        await setPipelineStatus(pipeline.id, value === 'on');
        await mutate();
      } catch (err: any) {
        toaster.show(err?.message || 'Failed to update Pipeline status.', 'warning');
      } finally {
        setPendingId(null);
      }
    },
    [mutate, setPipelineStatus, toaster]
  );

  const confirmDelete = useCallback(
    (pipeline: PipelineSummary) => async () => {
      const approved = await decision.open({
        title: t('delete_pipeline', 'Delete Pipeline?'),
        description: `Deleting "${pipeline.name}" will remove the Pipeline schedule. ${pipeline.queueCount} queued item${pipeline.queueCount === 1 ? '' : 's'} will be preserved as drafts in your calendar — no content will be deleted.`,
        approveLabel: t('delete_pipeline_confirm', 'Delete Pipeline'),
        cancelLabel: t('cancel', 'Cancel'),
      });
      if (!approved) {
        return;
      }
      setPendingId(pipeline.id);
      try {
        await deletePipeline(pipeline.id);
        toaster.show(
          t('pipeline_deleted_successfully', 'Pipeline deleted. Queued posts were kept as drafts.'),
          'success'
        );
        await mutate();
      } catch (err: any) {
        toaster.show(err?.message || 'Failed to delete Pipeline.', 'warning');
      } finally {
        setPendingId(null);
      }
    },
    [decision, deletePipeline, mutate, t, toaster]
  );

  if (isLoading) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[15px] transition-all items-center justify-center">
        <LoadingComponent />
      </div>
    );
  }

  return (
    <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[20px] transition-all text-textColor">
      <div className="flex flex-col gap-[6px]">
        <h1 className="text-[24px] font-[600]">
          {t('pipelines', 'Pipelines')} ({data?.length || 0})
        </h1>
        <p className="text-[14px] opacity-70 max-w-[760px]">
          {t(
            'pipelines_description',
            'Schedule recurring posting slots for a fixed set of channels. Queue content without picking dates — the server projects the next available slot in the Pipeline timezone.'
          )}
        </p>
      </div>

      {error && (
        <div className="rounded-[12px] border border-red-500/30 bg-newBgColor px-[16px] py-[12px] text-[14px] text-red-500">
          {t('pipelines_load_error', 'Failed to load Pipelines. Please refresh and try again.')}
        </div>
      )}

      <div className="flex justify-between items-center gap-[12px] flex-wrap">
        <Button onClick={openCreate}>{t('create_pipeline', 'Create Pipeline')}</Button>
      </div>

      {!data?.length ? (
        <div className="rounded-[12px] border border-newBorder bg-newBgColor p-[32px] flex flex-col items-center justify-center gap-[12px] text-center">
          <div className="text-[18px] font-[600]">
            {t('no_pipelines_yet', 'No Pipelines yet')}
          </div>
          <div className="text-[14px] opacity-70 max-w-[520px]">
            {t(
              'no_pipelines_description',
              'Create a Pipeline to define channels and timezone, then configure weekly posting times from its detail page.'
            )}
          </div>
          <Button onClick={openCreate}>{t('create_pipeline', 'Create Pipeline')}</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-[12px]">
          {data.map((pipeline) => (
            <div
              key={pipeline.id}
              className={clsx(
                'rounded-[12px] border border-newBorder bg-newBgColor overflow-hidden',
                pendingId === pipeline.id && 'opacity-70 pointer-events-none'
              )}
            >
              <div className="px-[20px] py-[16px] border-b border-newBorder flex flex-col gap-[12px] lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-[8px] min-w-0">
                  <div className="flex items-center gap-[10px] flex-wrap">
                    <div className="text-[18px] font-[600] truncate">{pipeline.name}</div>
                    <span
                      className={clsx(
                        'text-[12px] px-[8px] py-[2px] rounded-full border',
                        pipeline.active
                          ? 'border-green-500/40 text-green-500'
                          : 'border-newBorder opacity-70'
                      )}
                    >
                      {pipeline.active
                        ? t('active', 'Active')
                        : t('paused', 'Paused')}
                    </span>
                  </div>
                  <div className="text-[13px] opacity-70">
                    {t('timezone', 'Timezone')}: {pipeline.timezone}
                  </div>
                </div>
                <div className="flex items-center gap-[10px] flex-wrap">
                  <Button onClick={() => router.push(`/pipelines/${pipeline.id}`)}>
                    {t('open', 'Open')}
                  </Button>
                  <Button secondary onClick={() => openEdit(pipeline)}>
                    {t('edit', 'Edit')}
                  </Button>
                  <Button secondary onClick={confirmDelete(pipeline)}>
                    {t('delete', 'Delete')}
                  </Button>
                  <div className="flex items-center gap-[8px] px-[8px]">
                    <span className="text-[12px] opacity-70">
                      {pipeline.active ? t('pause', 'Pause') : t('resume', 'Resume')}
                    </span>
                    <Slider
                      value={pipeline.active ? 'on' : 'off'}
                      onChange={toggleActive(pipeline)}
                      fill={true}
                    />
                  </div>
                </div>
              </div>
              <div className="px-[20px] py-[16px] grid grid-cols-1 md:grid-cols-3 gap-[16px]">
                <div className="flex flex-col gap-[6px]">
                  <div className="text-[12px] uppercase opacity-60">
                    {t('channels', 'Channels')}
                  </div>
                  <PipelineChannels channels={pipeline.channels} />
                </div>
                <div className="flex flex-col gap-[6px]">
                  <div className="text-[12px] uppercase opacity-60">
                    {t('queued', 'Queued')}
                  </div>
                  <div className="text-[16px] font-[600]">{pipeline.queueCount}</div>
                </div>
                <div className="flex flex-col gap-[6px]">
                  <div className="text-[12px] uppercase opacity-60">
                    {t('next_slot', 'Next slot')}
                  </div>
                  <div className="text-[14px]">
                    {pipeline.active
                      ? formatPipelineSlot(pipeline.nextSlot, pipeline.timezone)
                      : t('pipeline_paused', 'Paused')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
