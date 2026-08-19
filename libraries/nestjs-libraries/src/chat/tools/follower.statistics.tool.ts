import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import {
  followerToolAnnotations,
  getFollowerToolContext,
} from '@gitroom/nestjs-libraries/chat/tools/follower.tool.common';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import {
  FOLLOWER_AUDIENCES,
  FOLLOWER_TRIAGE_FILTERS,
} from '@gitroom/nestjs-libraries/integrations/social/follower.sorts';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import z from 'zod';

const countFromPage = (page: { total?: number }) => page.total ?? null;

@Injectable()
export class FollowerStatisticsTool implements AgentToolInterface {
  constructor(private _integrationService: IntegrationService) {}
  name = 'summarizeFollowerAudience';

  run() {
    return createTool({
      id: this.name,
      description:
        'Summarize one channel’s audience using bounded count probes. Totals are null when the channel cannot provide one. Category counts use stored audience data; the named-list breakdown includes at most 20 lists and reports truncation.',
      inputSchema: z.object({
        channelId: z.string().min(1).max(64),
      }),
      mcp: { annotations: { ...followerToolAnnotations, title: 'Summarize follower audience' } },
      outputSchema: z.object({
        output: z.object({
          total: z.number().nullable(),
          categories: z.record(z.string(), z.number().nullable()),
          tracking: z.any().nullable(),
          lists: z.array(z.object({ id: z.string(), name: z.string(), total: z.number().nullable() })),
          listsTruncated: z.boolean(),
        }),
      }),
      execute: async (inputData, context) => {
        const { organization, actor } = getFollowerToolContext(inputData, context);
        const [all, stored] = await Promise.all([
          this._integrationService.getFollowers(
            organization,
            actor,
            inputData.channelId,
            { limit: 1 }
          ),
          this._integrationService.getStoredFollowerAudienceCounts(
            organization,
            inputData.channelId
          ),
        ]);

        return {
          output: {
            total: countFromPage(all),
            categories: Object.fromEntries(
              [...FOLLOWER_TRIAGE_FILTERS, ...FOLLOWER_AUDIENCES].map(
                (category) => [category, stored.categories[category] ?? null]
              )
            ),
            tracking: all.tracking ?? null,
            lists: stored.lists,
            listsTruncated: stored.listsTruncated,
          },
        };
      },
    });
  }
}
