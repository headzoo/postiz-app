import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { PipelineService } from '@gitroom/nestjs-libraries/database/prisma/pipelines/pipeline.service';
import z from 'zod';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class PipelinesListTool implements AgentToolInterface {
  constructor(private _pipelineService: PipelineService) {}
  name = 'listPipelines';

  run() {
    return createTool({
      id: 'listPipelines',
      description: `This tool lists the organization's pipelines (content queues with weekly schedules). Use a pipeline id with the listPostsByPipeline tool to inspect queued posts.`,
      inputSchema: z.object({}),
      mcp: {
        annotations: {
          title: 'List Pipelines',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      outputSchema: z.object({
        output: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            timezone: z.string(),
            active: z.boolean(),
            queueCount: z.number(),
            nextSlot: z.string().optional(),
            channels: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                platform: z.string(),
                picture: z.string().nullable().optional(),
              })
            ),
          })
        ),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        const pipelines = await this._pipelineService.getPipelines(
          organizationId
        );

        return {
          output: pipelines.map((pipeline) => ({
            id: pipeline.id,
            name: pipeline.name,
            timezone: pipeline.timezone,
            active: pipeline.active,
            queueCount: pipeline.queueCount,
            nextSlot: pipeline.nextSlot
              ? new Date(pipeline.nextSlot).toISOString()
              : undefined,
            channels: (pipeline.channels || []).map((channel: any) => ({
              id: channel.id,
              name: channel.name,
              platform: channel.identifier,
              picture: channel.picture,
            })),
          })),
        };
      },
    });
  }
}
