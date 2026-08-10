'use client';

import { FC, useCallback, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useDrag, useDrop } from 'react-dnd';
import { Button } from '@gitroom/react/form/button';
import { DatePicker } from '@gitroom/frontend/components/launches/helpers/date.picker';
import { DNDProvider } from '@gitroom/frontend/components/launches/helpers/dnd.provider';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useDecisionModal, useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import { ExistingDataContextProvider } from '@gitroom/frontend/components/launches/helpers/use.existing.data';
import { PipelineDetail, PipelineQueueItem, PipelineSummary } from './pipeline.types';
import { buildQueueReorderBody, formatPipelineSlot } from './pipeline.utils';

const queueDragType = 'pipeline-queue-item';

const QueueItem: FC<{
  item: PipelineQueueItem;
  index: number;
  queue: PipelineQueueItem[];
  projectedFor?: string;
  timezone: string;
  pending: boolean;
  onMove: (from: number, to: number) => void;
  onAction: (item: PipelineQueueItem, action: 'remove' | 'delete' | 'publish-now') => void;
  onMoveTo: (item: PipelineQueueItem, pipelineId: string) => void;
  onSchedule: (item: PipelineQueueItem, date: string) => void;
  onEdit: (item: PipelineQueueItem) => void;
  destinations: PipelineSummary[];
}> = ({ item, index, queue, projectedFor, timezone, pending, onMove, onAction, onMoveTo, onSchedule, onEdit, destinations }) => {
  const [showSchedule, setShowSchedule] = useState(false);
  const [date, setDate] = useState(dayjs());
  const locked = pending || item.status === 'PUBLISHING';
  const queued = item.status === 'QUEUED';
  const cleanupAllowed = item.status === 'QUEUED' || item.status === 'FAILED';
  const roots = item.posts.filter((post) => !post.parentPostId);
  const [{ isDragging }, drag] = useDrag(() => ({
    type: queueDragType,
    item: { id: item.id, index },
    canDrag: !locked && item.status === 'QUEUED',
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }), [index, item.id, item.status, locked]);
  const [, drop] = useDrop(() => ({
    accept: queueDragType,
    hover: (dragged: { id: string; index: number }) => {
      if (dragged.index !== index && item.status === 'QUEUED') {
        onMove(dragged.index, index);
        dragged.index = index;
      }
    },
  }), [index, item.status, onMove]);
  const preview = roots.map((post) => post.content.replace(/<[^>]+>/g, '')).filter(Boolean).join(' · ');

  return (
    <div
      // @ts-ignore react-dnd connector type
      ref={drop}
      className="relative"
    >
      <div className={`rounded-[8px] border border-newBorder bg-newBgColorInner p-[12px] flex gap-[10px] ${isDragging ? 'opacity-40' : ''}`}>
        <button
          // @ts-ignore react-dnd connector type
          ref={drag}
          type="button"
          disabled={locked || item.status !== 'QUEUED'}
          className="cursor-grab disabled:cursor-not-allowed opacity-60 px-[4px]"
          aria-label="Drag queue item"
        >⠿</button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-[6px] items-center">
            <span className="font-[600] text-[13px]">#{index + 1}</span>
            <span className={`text-[11px] px-[7px] py-[2px] rounded-full border ${item.status === 'FAILED' ? 'border-red-500/40 text-red-500' : item.status === 'PUBLISHING' ? 'border-yellow-500/40 text-yellow-500' : 'border-newBorder opacity-70'}`}>{item.status}</span>
            {projectedFor && <span className="text-[12px] opacity-70">Pipeline time: {formatPipelineSlot(projectedFor, timezone)}</span>}
          </div>
          <div className="mt-[6px] text-[13px] line-clamp-2">{preview || 'Untitled post'}</div>
          <div className="mt-[7px] flex gap-[5px] flex-wrap">
            {roots.map((post) => <span key={post.id} className="text-[11px] border border-newBorder rounded-full px-[6px] py-[1px]">{post.integration.name}</span>)}
          </div>
          {item.error && <div className="mt-[7px] text-[12px] text-red-500">{item.error}</div>}
        </div>
        <div className="flex flex-col gap-[5px] items-end">
          <div className="flex gap-[4px]">
            <Button secondary disabled={!queued || locked || index === 0} onClick={() => onMove(index, index - 1)}>↑</Button>
            <Button secondary disabled={!queued || locked || index === queue.length - 1} onClick={() => onMove(index, index + 1)}>↓</Button>
          </div>
          <select disabled={!queued || locked || !destinations.length} className="bg-newBgColor border border-newBorder rounded-[6px] text-[12px] max-w-[150px]" defaultValue="" onChange={(event) => { if (event.target.value) onMoveTo(item, event.target.value); }}>
            <option value="">Move to…</option>
            {destinations.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
          </select>
          <div className="flex gap-[4px] flex-wrap justify-end">
            <Button secondary disabled={!queued || locked} onClick={() => onEdit(item)}>Edit</Button>
            <Button secondary disabled={!queued || locked} onClick={() => onAction(item, 'publish-now')}>Now</Button>
            <Button secondary disabled={!queued || locked} onClick={() => setShowSchedule(!showSchedule)}>Schedule</Button>
            <Button secondary disabled={!cleanupAllowed || locked} onClick={() => onAction(item, 'remove')}>Remove</Button>
            <Button secondary disabled={!cleanupAllowed || locked} onClick={() => onAction(item, 'delete')}>Delete</Button>
          </div>
        </div>
      </div>
      {showSchedule && <div className="p-[10px] border border-newBorder border-t-0 rounded-b-[8px] bg-newBgColor flex gap-[8px] items-center"><DatePicker date={date} onChange={setDate} /><Button disabled={!queued || locked} onClick={() => onSchedule(item, date.toISOString())}>Confirm schedule</Button></div>}
    </div>
  );
};

export const PipelineQueue: FC<{ pipeline: PipelineDetail; pipelines: PipelineSummary[]; mutate: () => Promise<PipelineDetail | undefined> }> = ({ pipeline, pipelines, mutate }) => {
  const fetch = useFetch();
  const modal = useModals();
  const decision = useDecisionModal();
  const toaster = useToaster();
  const [items, setItems] = useState(pipeline.queueItems);
  const [pending, setPending] = useState(false);
  const projections = useMemo(() => new Map(pipeline.projections.map((projection) => [projection.itemId, projection.projectedFor])), [pipeline.projections]);
  const queue = items.filter((item) => item.status === 'QUEUED');
  const otherItems = items.filter((item) => item.status !== 'QUEUED');
  const destinations = pipelines.filter((candidate) => candidate.id !== pipeline.id && candidate.channels.map((channel) => channel.id).sort().join(',') === pipeline.channels.map((channel) => channel.id).sort().join(','));

  const refresh = useCallback(async () => {
    const result = await mutate();
    if (result) setItems(result.queueItems);
  }, [mutate]);
  const move = useCallback(async (from: number, to: number) => {
    if (from === to || pending) return;
    const next = [...queue];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setItems([...next, ...otherItems]);
    setPending(true);
    try {
      await fetch(`/pipelines/${pipeline.id}/items/${item.id}/reorder`, { method: 'POST', body: JSON.stringify(buildQueueReorderBody(next, to)) });
      await refresh();
    } catch (error: any) {
      setItems(pipeline.queueItems);
      toaster.show(error?.message || 'Unable to reorder queue.', 'warning');
    } finally { setPending(false); }
  }, [fetch, otherItems, pending, pipeline.id, pipeline.queueItems, queue, refresh, toaster]);
  const action = useCallback(async (item: PipelineQueueItem, type: 'remove' | 'delete' | 'publish-now') => {
    const actionText = type === 'publish-now' ? 'Publish now' : type === 'delete' ? 'Delete' : 'Remove';
    const description = type === 'publish-now'
      ? 'This will detach the item and publish its channel posts immediately.'
      : type === 'delete'
      ? 'This will delete this content from the Pipeline and soft-delete its channel posts.'
      : 'This will remove the item from the Pipeline but keep its channel posts as drafts.';
    const approved = await decision.open({ title: `${actionText} this Pipeline item?`, description, approveLabel: 'Confirm', cancelLabel: 'Cancel' });
    if (!approved) return;
    setPending(true);
    try { await fetch(`/pipelines/items/${item.id}/action`, { method: 'POST', body: JSON.stringify({ action: type }) }); await refresh(); } catch (error: any) { toaster.show(error?.message || 'Unable to update queue item.', 'warning'); } finally { setPending(false); }
  }, [decision, fetch, refresh, toaster]);
  const moveTo = useCallback(async (item: PipelineQueueItem, destinationPipelineId: string) => {
    setPending(true);
    try { await fetch(`/pipelines/items/${item.id}/move`, { method: 'POST', body: JSON.stringify({ destinationPipelineId }) }); await refresh(); toaster.show('Item moved. Destination projections were updated.', 'success'); } catch (error: any) { toaster.show(error?.message || 'Unable to move queue item.', 'warning'); } finally { setPending(false); }
  }, [fetch, refresh, toaster]);
  const schedule = useCallback(async (item: PipelineQueueItem, date: string) => {
    setPending(true);
    try { await fetch(`/pipelines/items/${item.id}/schedule`, { method: 'POST', body: JSON.stringify({ date }) }); await refresh(); } catch (error: any) { toaster.show(error?.message || 'Unable to schedule queue item.', 'warning'); } finally { setPending(false); }
  }, [fetch, refresh, toaster]);
  const edit = useCallback((item: PipelineQueueItem) => {
    const channels = item.posts
      .filter((post) => !post.parentPostId)
      .map((root) => ({
        integration: root.integration.id,
        posts: item.posts.filter(
          (post) => post.integration.id === root.integration.id
        ),
        settings: root.settings || {},
      }));
    modal.openModal({ id: 'add-edit-modal', closeOnClickOutside: false, removeLayout: true, closeOnEscape: false, withCloseButton: false, askClose: true, fullScreen: true, classNames: { modal: 'w-[100%] max-w-[1400px] text-textColor' }, children: <ExistingDataContextProvider value={{ integration: channels[0]?.integration, group: item.group, posts: channels[0]?.posts || [], settings: channels[0]?.settings || {}, channels }}><AddEditModal allIntegrations={pipeline.channels} integrations={pipeline.channels} date={dayjs()} reopenModal={() => {}} mutate={refresh} /></ExistingDataContextProvider> });
  }, [modal, pipeline.channels, refresh]);

  return (
    <DNDProvider>
      <div className="rounded-[12px] border border-newBorder bg-newBgColor overflow-hidden">
        <div className="px-[20px] py-[14px] border-b border-newBorder text-[16px] font-[600]">
          Queue
        </div>
        <div className="p-[16px] flex flex-col gap-[10px]">
          {queue.length ? (
            queue.map((item, index) => (
              <QueueItem
                key={item.id}
                item={item}
                index={index}
                queue={queue}
                projectedFor={projections.get(item.id)}
                timezone={pipeline.timezone}
                pending={pending}
                onMove={move}
                onAction={action}
                onMoveTo={moveTo}
                onSchedule={schedule}
                onEdit={edit}
                destinations={destinations}
              />
            ))
          ) : (
            <div className="text-[13px] opacity-60">No queued items.</div>
          )}
          {otherItems.length > 0 && (
            <>
              <div className="mt-[8px] text-[13px] font-[600] opacity-70">
                Publishing and failed
              </div>
              {otherItems.map((item) => (
                <QueueItem
                  key={item.id}
                  item={item}
                  index={queue.length}
                  queue={queue}
                  projectedFor={projections.get(item.id)}
                  timezone={pipeline.timezone}
                  pending={pending}
                  onMove={move}
                  onAction={action}
                  onMoveTo={moveTo}
                  onSchedule={schedule}
                  onEdit={edit}
                  destinations={destinations}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </DNDProvider>
  );
};
