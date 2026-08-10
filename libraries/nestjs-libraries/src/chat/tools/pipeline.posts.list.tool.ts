import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { PipelineService } from '@gitroom/nestjs-libraries/database/prisma/pipelines/pipeline.service';
import z from 'zod';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

const integrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  platform: z.string(),
  picture: z.string().nullable().optional(),
});

@Injectable()
export class PipelinePostsListTool implements AgentToolInterface {
  constructor(private _pipelineService: PipelineService) {}
  name = 'listPostsByPipeline';

  run() {
    return createTool({
      id: 'listPostsByPipeline',
      description: `This tool lists the queued posts for a specific pipeline. Pass a pipeline id from the listPipelines tool.`,
      inputSchema: z.object({
        pipelineId: z
          .string()
          .describe('The pipeline id from the listPipelines tool'),
      }),
      mcp: {
        annotations: {
          title: 'List Posts By Pipeline',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      outputSchema: z.object({
        output: z.object({
          pipeline: z.object({
            id: z.string(),
            name: z.string(),
            timezone: z.string(),
            active: z.boolean(),
            nextSlot: z.string().optional(),
          }),
          queueItems: z.array(
            z.object({
              id: z.string(),
              position: z.number(),
              status: z.string(),
              group: z.string().nullable().optional(),
              error: z.string().nullable().optional(),
              projectedFor: z.string().optional(),
              posts: z.array(
                z.object({
                  id: z.string(),
                  content: z.string(),
                  state: z.string(),
                  integration: integrationSchema.nullable().optional(),
                })
              ),
            })
          ),
        }),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        const pipeline = await this._pipelineService.getPipeline(
          organizationId,
          inputData.pipelineId
        );

        const projectedByItemId = new Map(
          (pipeline.projections || []).map((projection) => [
            projection.itemId,
            projection.projectedFor,
          ])
        );

        return {
          output: {
            pipeline: {
              id: pipeline.id,
              name: pipeline.name,
              timezone: pipeline.timezone,
              active: pipeline.active,
              nextSlot: pipeline.nextSlot
                ? new Date(pipeline.nextSlot).toISOString()
                : undefined,
            },
            queueItems: (pipeline.queueItems || []).map((item) => {
              const projectedFor = projectedByItemId.get(item.id);
              return {
                id: item.id,
                position: item.position,
                status: item.status,
                group: item.group,
                error: item.error,
                projectedFor: projectedFor
                  ? new Date(projectedFor).toISOString()
                  : undefined,
                posts: (item.posts || []).map((post: any) => ({
                  id: post.id,
                  content: post.content,
                  state: post.state,
                  integration: post.integration
                    ? {
                        id: post.integration.id,
                        name: post.integration.name,
                        platform: post.integration.identifier,
                        picture: post.integration.picture,
                      }
                    : post.integration,
                })),
              };
            }),
          },
        };
      },
    });
  }
}
