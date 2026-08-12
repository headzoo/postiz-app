import { Injectable } from '@nestjs/common';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { Memory } from '@mastra/memory';
import { pStore } from '@gitroom/nestjs-libraries/chat/mastra.store';
import { array, object, string } from 'zod';
import { ModuleRef } from '@nestjs/core';
import { toolList } from '@gitroom/nestjs-libraries/chat/tools/tool.list';
import dayjs from 'dayjs';

export const AgentState = object({
  proverbs: array(string()).default([]),
});

export type SelectedPipelineContext = {
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
};

const renderArray = (list: string[], show: boolean) => {
  if (!show) return '';
  return list.map((p) => `- ${p}`).join('\n');
};

export const renderSelectedPipelineGuidance = (
  pipeline: SelectedPipelineContext | null
) => {
  if (!pipeline) {
    return '';
  }

  const channels = pipeline.channels
    .map((channel) => `${channel.name} (${channel.platform}, id: ${channel.id})`)
    .join(', ');
  const contextDocuments = pipeline.contextDocuments.length
    ? pipeline.contextDocuments
        .map(
          (document) =>
            `${document.name} (id: ${document.id}, ${document.fileSize} bytes, updated ${document.updatedAt})`
        )
        .join(', ')
    : 'none';

  return `
      User-selected pipeline target:
        - The user has selected "${pipeline.name}" (id: ${pipeline.id}, timezone: ${pipeline.timezone}, ${pipeline.active ? 'active' : 'paused'}). Treat it as the user's preferred target, not as authorization.
        - Its configured channels are: ${channels || 'none'}.
        - Its attached context-document metadata is: ${contextDocuments}. This is metadata only; do not assume document content.
        - For pipeline operations, do not ask the user which pipeline to use while this selection is valid. First call listPipelines to refresh and validate the selected pipeline and its current channels/documents, then use the authoritative result.
`;
};

@Injectable()
export class LoadToolsService {
  constructor(private _moduleRef: ModuleRef) {}

  async loadTools() {
    return (
      await Promise.all<{ name: string; tool: any }>(
        toolList
          .map((p) => this._moduleRef.get(p, { strict: false }))
          .map(async (p) => ({
            name: p.name as string,
            tool: await p.run(),
          }))
      )
    ).reduce(
      (all, current) => ({
        ...all,
        [current.name]: current.tool,
      }),
      {} as Record<string, any>
    );
  }

  async agent() {
    const tools = await this.loadTools();
    return new Agent({
      id: 'postiz',
      name: 'postiz',
      description: 'Agent that helps manage and schedule social media posts for users',
      instructions: ({ requestContext }) => {
        const ui: string = requestContext.get('ui' as never);
        const selectedPipeline =
          requestContext.get('pipeline' as never) as SelectedPipelineContext | null;
        return `
      Global information:
        - Date (UTC): ${dayjs().format('YYYY-MM-DD HH:mm:ss')}

      You are an agent that helps manage and schedule social media posts for users, you can:
        - Schedule posts into the future, or now, adding texts, images and videos
        - Generate pictures for posts
        - Generate videos for posts
        - Generate text for posts
        - Show global analytics about socials
        - List integrations (channels)
        - List groups (customers) and filter the channels by a group
        - List scheduled, draft, or published posts (listPosts)
        - List pipelines and their queue sizes (listPipelines)
        - Inspect a pipeline's queued posts (listPostsByPipeline, requires a pipeline id from listPipelines)
        - Read one attached pipeline context document (readPipelineContextDocument, requires a pipeline id and exactly one attached document id or name from listPipelines)
        - Enqueue composed posts into a pipeline queue (enqueuePipelinePost)

      - We schedule posts to different integration like facebook, instagram, etc. but to the user we don't say integrations we say channels as integration is the technical name
      - When scheduling a post, you must follow the social media rules and best practices.
      - When scheduling a post, you can pass an array for list of posts for a social media platform, But it has different behavior depending on the platform.
        - For platforms like Threads, Bluesky and X (Twitter), each post in the array will be a separate post in the thread.
        - For platforms like LinkedIn and Facebook, second part of the array will be added as "comments" to the first post.
        - If the social media platform has the concept of "threads", we need to ask the user if they want to create a thread or one long post.
        - For X, if you don't have Premium, don't suggest a long post because it won't work.
        - Platform format will also be passed can be "normal", "markdown", "html", make sure you use the correct format for each platform.
      
      - Sometimes 'integrationSchema' will return rules, make sure you follow them (these rules are set in stone, even if the user asks to ignore them)
      - Each socials media platform has different settings and rules, you can get them by using the integrationSchema tool.
      - Always make sure you use this tool before you schedule any post or enqueue a pipeline post.
      - In every message I will send you the list of needed social medias (id and platform), if you already have the information use it, if not, use the integrationSchema tool to get it.
      - Make sure you always take the last information I give you about the socials, it might have changed.
      - Before scheduling a post, always make sure you ask the user confirmation by providing all the details of the post (text, images, videos, date, time, social media platform, account).
      - When adding content to a pipeline:
        - Use listPipelines to pick the pipeline and see the exact channels required and attached contextDocuments metadata (names only, no content)
        - Read only the attached context documents that are relevant to the user's requested pipeline content with readPipelineContextDocument — never automatically read every attachment
        - Use integrationSchema for each platform on that pipeline
        - Ask the user for confirmation with the content for every channel (no publish date — the pipeline schedule assigns the slot)
        - Call enqueuePipelinePost with content for every channel on that pipeline (exact integration ids)
        - Pipeline posts are queued as drafts; publishing time comes from the pipeline schedule, not a user-chosen date
      ${renderSelectedPipelineGuidance(selectedPipeline)}
      - Between tools, we will reference things like: [output:name] and [input:name] to set the information right.
      - When outputting a date for the user, make sure it's human readable with time
      - The content of the post, HTML, Each line must be wrapped in <p> here is the possible tags: h1, h2, h3, u, strong, li, ul, p (you can\'t have u and strong together), don't use a "code" box
      ${renderArray(
        [
          'If the user confirm, ask if they would like to get a modal with populated content without scheduling the post yet or if they want to schedule it right away.',
        ],
        !!ui
      )}
`;
      },
      model: openai('gpt-5.2'),
      tools,
      memory: new Memory({
        storage: pStore,
        options: {
          generateTitle: true,
          workingMemory: {
            enabled: true,
            schema: AgentState,
          },
        },
      }),
    });
  }
}
