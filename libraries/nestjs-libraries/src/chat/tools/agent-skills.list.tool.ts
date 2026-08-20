import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import { ContextDocumentService } from '@gitroom/nestjs-libraries/database/prisma/context-documents/context-document.service';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import z from 'zod';

const skillMetadataSchema = z.object({
  slug: z.string(),
  command: z.string(),
  id: z.string(),
  name: z.string(),
  fileSize: z.number(),
  updatedAt: z.string(),
  isLarge: z.boolean(),
  warning: z.string().optional(),
});

@Injectable()
export class AgentSkillsListTool implements AgentToolInterface {
  constructor(private _contextDocumentService: ContextDocumentService) {}
  name = 'listSkills';

  run() {
    return createTool({
      id: 'listSkills',
      description: `
This tool lists organization agent skills as metadata only (slug, command, id, name, fileSize, updatedAt).
Use it to discover available /slug procedures before calling loadSkill.
It never returns skill Markdown content.
`,
      inputSchema: z.object({}),
      mcp: {
        annotations: {
          title: 'List Organization Agent Skills',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      outputSchema: z.object({
        output: z.array(skillMetadataSchema),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        const skills = await this._contextDocumentService.listSkills(
          organizationId
        );

        return {
          output: skills.map((skill) => ({
            slug: skill.slug,
            command: skill.command,
            id: skill.id,
            name: skill.name,
            fileSize: skill.fileSize,
            updatedAt: new Date(skill.updatedAt).toISOString(),
            isLarge: skill.isLarge,
            ...(skill.warning ? { warning: skill.warning } : {}),
          })),
        };
      },
    });
  }
}
