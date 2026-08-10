import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { expandPostsList } from '@gitroom/helpers/utils/posts.list.minify';
import z from 'zod';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

const integrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  platform: z.string(),
  picture: z.string().nullable().optional(),
});

@Injectable()
export class PostsListTool implements AgentToolInterface {
  constructor(private _postsService: PostsService) {}
  name = 'listPosts';

  run() {
    return createTool({
      id: 'listPosts',
      description: `This tool lists scheduled, draft, or published posts for the organization. Supports pagination and optional filtering by state and group (customer) id from the groupList tool.`,
      inputSchema: z.object({
        page: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Page number starting from 0 (default 0)'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('Number of posts per page (default 20, max 100)'),
        state: z
          .enum(['all', 'scheduled', 'draft', 'published'])
          .optional()
          .describe(
            'Filter by post state: all, scheduled, draft, or published (default all)'
          ),
        customer: z
          .string()
          .optional()
          .describe(
            'Optional group (customer) id from the groupList tool to filter posts'
          ),
      }),
      mcp: {
        annotations: {
          title: 'List Posts',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      outputSchema: z.object({
        output: z.object({
          posts: z.array(
            z.object({
              id: z.string(),
              content: z.string(),
              publishDate: z.string(),
              state: z.string(),
              group: z.string().nullable().optional(),
              releaseURL: z.string().nullable().optional(),
              integration: integrationSchema.nullable().optional(),
              tags: z.array(z.any()).optional(),
            })
          ),
          total: z.number(),
          page: z.number(),
          limit: z.number(),
          hasMore: z.boolean(),
        }),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        const list = expandPostsList(
          await this._postsService.getPostsList(organizationId, {
            page: inputData.page ?? 0,
            limit: inputData.limit ?? 20,
            state: inputData.state ?? 'all',
            customer: inputData.customer,
          })
        );

        return {
          output: {
            posts: list.posts.map((post: any) => ({
              id: post.id,
              content: post.content,
              publishDate: post.publishDate
                ? new Date(post.publishDate).toISOString()
                : post.publishDate,
              state: post.state,
              group: post.group,
              releaseURL: post.releaseURL,
              integration: post.integration
                ? {
                    id: post.integration.id,
                    name: post.integration.name,
                    platform: post.integration.providerIdentifier,
                    picture: post.integration.picture,
                  }
                : post.integration,
              tags: post.tags,
            })),
            total: list.total,
            page: list.page,
            limit: list.limit,
            hasMore: list.hasMore,
          },
        };
      },
    });
  }
}
