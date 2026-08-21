'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { parseApiError } from '@gitroom/frontend/components/pipelines/pipeline.utils';
import {
  ContextDocumentMetadata,
  getContextDocumentSkillSlug,
} from '@gitroom/frontend/components/context-documents/context-document.types';
import { CONTEXT_DOCUMENTS_KEY } from '@gitroom/frontend/components/context-documents/use.context-document.list';
import {
  contextDocumentContentKey,
  contextDocumentSkillContentKey,
} from '@gitroom/frontend/components/context-documents/use.context-document.content';
import { PIPELINES_KEY } from '@gitroom/frontend/components/pipelines/use.pipeline.list';
import { AGENT_SKILLS_KEY } from '@gitroom/frontend/components/agents/use.agent.skills';

export const useContextDocumentRename = () => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();

  return useCallback(
    async (id: string, name: string, previousName?: string) => {
      const response = await fetch(`${CONTEXT_DOCUMENTS_KEY}/${id}/rename`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const renamed = (await response.json()) as ContextDocumentMetadata;
      const previousSkillSlug = getContextDocumentSkillSlug(previousName);
      const nextSkillSlug =
        renamed.skill?.slug || getContextDocumentSkillSlug(renamed.name);

      await Promise.all([
        mutate(CONTEXT_DOCUMENTS_KEY),
        mutate(AGENT_SKILLS_KEY),
        mutate(PIPELINES_KEY),
        ...(nextSkillSlug
          ? [mutate(contextDocumentSkillContentKey(nextSkillSlug))]
          : [mutate(contextDocumentContentKey(renamed.id))]),
        ...(previousSkillSlug && previousSkillSlug !== nextSkillSlug
          ? [mutate(contextDocumentSkillContentKey(previousSkillSlug))]
          : []),
      ]);

      return renamed;
    },
    [fetch, mutate]
  );
};
