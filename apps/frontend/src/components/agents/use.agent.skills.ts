'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { AgentSkillMetadata } from '@gitroom/frontend/components/context-documents/context-document.types';
import { parseApiError } from '@gitroom/frontend/components/pipelines/pipeline.utils';

const AGENT_SKILLS_KEY = '/context-documents/skills';

export const useAgentSkills = () => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    const response = await fetch(AGENT_SKILLS_KEY);

    if (!response.ok) {
      throw new Error(await parseApiError(response));
    }

    return response.json() as Promise<AgentSkillMetadata[]>;
  }, [fetch]);

  return useSWR<AgentSkillMetadata[]>(AGENT_SKILLS_KEY, load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [],
  });
};

export { AGENT_SKILLS_KEY };
