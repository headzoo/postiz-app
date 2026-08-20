import { IntegrationValidationTool } from '@gitroom/nestjs-libraries/chat/tools/integration.validation.tool';
import { IntegrationTriggerTool } from '@gitroom/nestjs-libraries/chat/tools/integration.trigger.tool';
import { IntegrationSchedulePostTool } from './integration.schedule.post';
import { GenerateVideoOptionsTool } from '@gitroom/nestjs-libraries/chat/tools/generate.video.options.tool';
import { VideoFunctionTool } from '@gitroom/nestjs-libraries/chat/tools/video.function.tool';
import { GenerateVideoTool } from '@gitroom/nestjs-libraries/chat/tools/generate.video.tool';
import { GenerateImageTool } from '@gitroom/nestjs-libraries/chat/tools/generate.image.tool';
import { IntegrationListTool } from '@gitroom/nestjs-libraries/chat/tools/integration.list.tool';
import { GroupListTool } from '@gitroom/nestjs-libraries/chat/tools/group.list.tool';
import { UploadFromUrlTool } from '@gitroom/nestjs-libraries/chat/tools/upload.from.url.tool';
import { PostsListTool } from '@gitroom/nestjs-libraries/chat/tools/posts.list.tool';
import { PipelinesListTool } from '@gitroom/nestjs-libraries/chat/tools/pipelines.list.tool';
import { PipelinePostsListTool } from '@gitroom/nestjs-libraries/chat/tools/pipeline.posts.list.tool';
import { PipelineEnqueuePostTool } from '@gitroom/nestjs-libraries/chat/tools/pipeline.enqueue.post.tool';
import { PipelineContextDocumentReadTool } from '@gitroom/nestjs-libraries/chat/tools/pipeline.context-document.read.tool';
import { FollowerChannelsTool } from '@gitroom/nestjs-libraries/chat/tools/follower.channels.tool';
import { FollowersListTool } from '@gitroom/nestjs-libraries/chat/tools/followers.list.tool';
import { FollowerDetailTool } from '@gitroom/nestjs-libraries/chat/tools/follower.detail.tool';
import { FollowerTimelineTool } from '@gitroom/nestjs-libraries/chat/tools/follower.timeline.tool';
import { FollowerListsTool } from '@gitroom/nestjs-libraries/chat/tools/follower.lists.tool';
import { FollowerStatisticsTool } from '@gitroom/nestjs-libraries/chat/tools/follower.statistics.tool';
import { AgentSkillsListTool } from '@gitroom/nestjs-libraries/chat/tools/agent-skills.list.tool';
import { AgentSkillLoadTool } from '@gitroom/nestjs-libraries/chat/tools/agent-skill.load.tool';

export const toolList = [
  IntegrationListTool,
  GroupListTool,
  PostsListTool,
  FollowerChannelsTool,
  FollowersListTool,
  FollowerDetailTool,
  FollowerTimelineTool,
  FollowerListsTool,
  FollowerStatisticsTool,
  PipelinesListTool,
  PipelinePostsListTool,
  PipelineEnqueuePostTool,
  PipelineContextDocumentReadTool,
  AgentSkillsListTool,
  AgentSkillLoadTool,
  IntegrationValidationTool,
  IntegrationTriggerTool,
  IntegrationSchedulePostTool,
  GenerateVideoOptionsTool,
  VideoFunctionTool,
  GenerateVideoTool,
  GenerateImageTool,
  UploadFromUrlTool,
];
