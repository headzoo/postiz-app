'use client';

import React, {
  createContext,
  FC,
  useCallback,
  useMemo,
  useState,
  ReactNode,
  KeyboardEvent,
} from 'react';
import clsx from 'clsx';
import useSWR from 'swr';
import { SVGLine } from '@gitroom/frontend/components/launches/launches.component';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useWaitForClass } from '@gitroom/helpers/utils/use.wait.for.class';
import { MultiMediaComponent } from '@gitroom/frontend/components/media/media.component';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Integrations } from '@gitroom/frontend/components/launches/calendar.context';
import { PipelineSummary } from '@gitroom/frontend/components/pipelines/pipeline.types';
import { usePipelineList } from '@gitroom/frontend/components/pipelines/use.pipeline.list';
import { PipelineChannels } from '@gitroom/frontend/components/pipelines/pipeline.channels';
import {
  ChannelMenu,
  ChannelsSidebar,
} from '@gitroom/frontend/components/launches/channels.sidebar';
import {
  IntegrationListItem,
  useIntegrationList,
} from '@gitroom/frontend/components/launches/helpers/use.integration.list';

export interface AgentSelectionState {
  properties: Integrations[];
  selectedPipeline: PipelineSummary | null;
}

export interface SelectedPipelineContext {
  id: string;
  name: string;
  timezone: string;
  active: boolean;
  channels: Array<{
    id: string;
    name: string;
    platform: string;
    picture: string;
  }>;
  contextDocuments: Array<{
    id: string;
    name: string;
    fileSize: number;
    updatedAt: string;
  }>;
}

export const defaultAgentSelectionState: AgentSelectionState = {
  properties: [],
  selectedPipeline: null,
};

export function mapSelectedPipelineContext(
  pipeline: PipelineSummary | null
): SelectedPipelineContext | null {
  if (!pipeline) {
    return null;
  }

  return {
    id: pipeline.id,
    name: pipeline.name,
    timezone: pipeline.timezone,
    active: pipeline.active,
    channels: pipeline.channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      platform: channel.identifier,
      picture: channel.picture,
    })),
    contextDocuments: (pipeline.contextDocuments || []).map((document) => ({
      id: document.id,
      name: document.name,
      fileSize: document.fileSize,
      updatedAt: document.updatedAt,
    })),
  };
}

export function buildAgentTransportMetadata(
  properties: Integrations[],
  selectedPipeline: PipelineSummary | null
): string {
  const pipeline = mapSelectedPipelineContext(selectedPipeline);
  const integrations = properties.length
    ? `\n[--integrations--]
Use the following social media platforms: ${JSON.stringify(
      properties.map((p) => ({
        id: p.id,
        platform: p.identifier,
        profilePicture: p.picture,
        additionalSettings: p.additionalSettings,
      }))
    )}
[--integrations--]`
    : '';

  return (
    integrations +
    (pipeline
      ? `\n[--pipeline--]
${JSON.stringify(pipeline)}
[--pipeline--]`
      : '')
  );
}

export function stripAgentTransportMetadata(content: string): string {
  return content
    .replace(/\n?\[--integrations--\][\s\S]*?\[--integrations--\]/g, '')
    .replace(/\n?\[--pipeline--\][\s\S]*?\[--pipeline--\]/g, '');
}

export function applyChannelToggle(
  properties: Integrations[],
  selectedPipeline: PipelineSummary | null,
  integration: Integrations
): AgentSelectionState {
  const currentProperties = properties;
  const isSelected = currentProperties.some((p) => p.id === integration.id);

  if (isSelected) {
    return {
      properties: currentProperties.filter((p) => p.id !== integration.id),
      selectedPipeline: null,
    };
  }

  return {
    properties: [...currentProperties, integration],
    selectedPipeline: null,
  };
}

export function applyPipelineSelection(
  selectedPipeline: PipelineSummary | null,
  pipeline: PipelineSummary
): AgentSelectionState {
  if (selectedPipeline?.id === pipeline.id) {
    return { properties: [], selectedPipeline: null };
  }

  return {
    properties: [...pipeline.channels],
    selectedPipeline: pipeline,
  };
}

export const MediaPortal: FC<{
  media: { path: string; id: string }[];
  value: string;
  setMedia: (event: {
    target: {
      name: string;
      value?: {
        id: string;
        path: string;
        alt?: string;
        thumbnail?: string;
        thumbnailTimestamp?: number;
      }[];
    };
  }) => void;
}> = ({ media, setMedia, value }) => {
  const waitForClass = useWaitForClass('copilotKitMessages');
  const t = useT();
  if (!waitForClass) return null;
  return (
    <div className="pl-[14px] pr-[24px] whitespace-nowrap editor rm-bg">
      <MultiMediaComponent
        allData={[{ content: value }]}
        text={value}
        label={t('attachments', 'Attachments')}
        description=""
        value={media}
        dummy={false}
        name="image"
        onChange={setMedia}
        onOpen={() => { }}
        onClose={() => { }}
      />
    </div>
  );
};

export const AgentList: FC<{
  selectedIntegrations: Integrations[];
  selectedPipeline: PipelineSummary | null;
  onToggleIntegration: (integration: Integrations) => void;
  onSelectPipeline: (pipeline: PipelineSummary) => void;
}> = ({
  selectedIntegrations,
  selectedPipeline,
  onToggleIntegration,
  onSelectPipeline,
}) => {
    const t = useT();
    const { data: integrations = [] } = useIntegrationList();

    const {
      data: pipelines,
      error: pipelinesError,
      isLoading: pipelinesLoading,
    } = usePipelineList();

    const pipelinesLabel = t('pipelines', 'Pipelines');

    const handlePipelineKeyDown = useCallback(
      (pipeline: PipelineSummary) => (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectPipeline(pipeline);
        }
      },
      [onSelectPipeline]
    );

    const handleSelect = useCallback(
      (integration: IntegrationListItem) => {
        onToggleIntegration(integration as Integrations);
      },
      [onToggleIntegration]
    );

    return (
      <ChannelsSidebar
        integrationCount={integrations.length}
        showAddProvider={false}
      >
        {(collapsed) => (
          <>
            <ChannelMenu
              collapsed={collapsed}
              integrations={integrations}
              selectedIds={selectedIntegrations.map((integration) => integration.id)}
              onSelect={handleSelect}
            />
            <div
              className="pt-[20px] border-t border-newBorder flex flex-col gap-[15px]"
              role="radiogroup"
              aria-label={pipelinesLabel}
            >
              <h2 className="group-[.sidebar]:hidden text-[20px] font-[500]">
                {pipelinesLabel}
              </h2>

              {pipelinesLoading && (
                <div className="text-[13px] opacity-60 group-[.sidebar]:hidden">
                  {t('loading', 'Loading...')}
                </div>
              )}

              {pipelinesError && !pipelinesLoading && (
                <div className="text-[13px] text-red-500 group-[.sidebar]:hidden">
                  {t(
                    'pipelines_load_error',
                    'Failed to load Pipelines. Please refresh and try again.'
                  )}
                </div>
              )}

              {!pipelinesLoading &&
                !pipelinesError &&
                !pipelines?.length && (
                  <div className="text-[13px] opacity-60 group-[.sidebar]:hidden">
                    {t('no_pipelines_yet', 'No Pipelines yet')}
                  </div>
                )}

              {(pipelines || []).map((pipeline) => {
                const isSelected = selectedPipeline?.id === pipeline.id;
                const statusLabel = pipeline.active
                  ? t('active', 'Active')
                  : t('paused', 'Paused');

                return (
                  <div
                    key={pipeline.id}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    title={pipeline.name}
                    onClick={() => onSelectPipeline(pipeline)}
                    onKeyDown={handlePipelineKeyDown(pipeline)}
                    className={clsx(
                      'flex gap-[12px] items-center group/pipeline justify-center hover:bg-boxHover rounded-e-[8px] hover:opacity-100 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary',
                      !isSelected && 'opacity-20'
                    )}
                  >
                    <div className="relative flex justify-center items-center gap-[6px] min-w-[36px]">
                      <div className="h-full w-[4px] -ms-[12px] rounded-s-[3px] opacity-0 group-hover/pipeline:opacity-100 transition-opacity">
                        <SVGLine />
                      </div>
                      <div
                        className="w-[12px] h-[12px] rounded-full shrink-0 border border-newBorder"
                        style={{ backgroundColor: pipeline.color }}
                        aria-hidden="true"
                      />
                      <div className="group-[.sidebar]:flex hidden">
                        <PipelineChannels channels={pipeline.channels} compact />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-[4px] group-[.sidebar]:hidden">
                      <div className="flex items-center gap-[8px] min-w-0">
                        <span className="flex-1 whitespace-nowrap text-ellipsis overflow-hidden">
                          {pipeline.name}
                        </span>
                        <span
                          className={clsx(
                            'text-[10px] px-[6px] py-[1px] rounded-full border shrink-0',
                            pipeline.active
                              ? 'border-green-500/40 text-green-500'
                              : 'border-newBorder opacity-70'
                          )}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <PipelineChannels channels={pipeline.channels} compact />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </ChannelsSidebar>
    );
  };

export const PropertiesContext =
  createContext<AgentSelectionState>(defaultAgentSelectionState);

export const Agent: FC<{ children: ReactNode }> = ({ children }) => {
  const [selection, setSelection] = useState<AgentSelectionState>(
    defaultAgentSelectionState
  );

  const handleToggleIntegration = useCallback((integration: Integrations) => {
    setSelection((current) =>
      applyChannelToggle(
        current.properties,
        current.selectedPipeline,
        integration
      )
    );
  }, []);

  const handleSelectPipeline = useCallback((pipeline: PipelineSummary) => {
    setSelection((current) =>
      applyPipelineSelection(current.selectedPipeline, pipeline)
    );
  }, []);

  const contextValue = useMemo(() => selection, [selection]);

  return (
    <PropertiesContext.Provider value={contextValue}>
      <AgentList
        selectedIntegrations={selection.properties}
        selectedPipeline={selection.selectedPipeline}
        onToggleIntegration={handleToggleIntegration}
        onSelectPipeline={handleSelectPipeline}
      />
      <div className="bg-newBgColorInner flex flex-1">{children}</div>
      <Threads />
    </PropertiesContext.Provider>
  );
};

const Threads: FC = () => {
  const fetch = useFetch();
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const threads = useCallback(async () => {
    return (await fetch('/copilot/list')).json();
  }, [fetch]);
  const { id } = useParams<{ id: string }>();

  const { data } = useSWR('threads', threads);

  return (
    <div
      className={clsx(
        'trz bg-newBgColorInner flex flex-col gap-[15px] transition-all relative',
        'w-[260px]'
      )}
    >
      <div className="absolute top-0 start-0 w-full h-full p-[20px] overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
        <div className="mb-[15px] justify-center flex group-[.sidebar]:pb-[15px]">
          <Link
            href={`/agents`}
            className="text-white whitespace-nowrap flex-1 pt-[12px] pb-[14px] ps-[16px] pe-[20px] group-[.sidebar]:p-0 min-h-[44px] max-h-[44px] rounded-md bg-btnPrimary flex justify-center items-center gap-[5px] outline-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="21"
              height="20"
              viewBox="0 0 21 20"
              fill="none"
              className="min-w-[21px] min-h-[20px]"
            >
              <path
                d="M10.5001 4.16699V15.8337M4.66675 10.0003H16.3334"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex-1 text-start text-[16px] group-[.sidebar]:hidden">
              {t('start_a_new_chat', 'Start a new chat')}
            </div>
          </Link>
        </div>
        <div className="flex flex-col gap-[1px]">
          {data?.threads?.map((p: any) => (
            <Link
              className={clsx(
                'overflow-ellipsis overflow-hidden whitespace-nowrap hover:bg-newBgColor px-[10px] py-[6px] rounded-[10px] cursor-pointer',
                p.id === id && 'bg-newBgColor'
              )}
              href={`/agents/${p.id}`}
              key={p.id}
            >
              {p.title}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
