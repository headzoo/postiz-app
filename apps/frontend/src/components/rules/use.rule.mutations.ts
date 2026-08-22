'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import {
  CreatePostRuleDto,
  UpdatePostRuleDto,
  PostRuleActivationDto,
  ReplacePostRuleAssignmentsDto,
} from '@gitroom/nestjs-libraries/dtos/rules/rule.dto';
import { RULES_KEY } from '@gitroom/frontend/components/rules/use.rules.list';
import { ruleDetailKey } from '@gitroom/frontend/components/rules/use.rule.detail';

const revalidateRuleCaches = async (
  mutate: ReturnType<typeof useSWRConfig>['mutate'],
  id?: string
) => {
  await Promise.all([
    mutate(RULES_KEY),
    ...(id ? [mutate(ruleDetailKey(id))] : []),
  ]);
};

export const useCreateRule = () => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();

  return useCallback(
    async (dto: CreatePostRuleDto) => {
      const response = await fetch('/rules', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => undefined);
        throw new Error(error?.message || 'Failed to create Rule.');
      }
      const result = await response.json();
      await revalidateRuleCaches(mutate);
      return result;
    },
    [fetch, mutate]
  );
};

export const useUpdateRule = () => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();

  return useCallback(
    async (id: string, dto: UpdatePostRuleDto) => {
      const response = await fetch(`/rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(dto),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => undefined);
        throw new Error(error?.message || 'Failed to update Rule.');
      }
      const result = await response.json();
      await revalidateRuleCaches(mutate, id);
      return result;
    },
    [fetch, mutate]
  );
};

export const useDeleteRule = () => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();

  return useCallback(
    async (id: string) => {
      const response = await fetch(`/rules/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => undefined);
        throw new Error(error?.message || 'Failed to delete Rule.');
      }
      await revalidateRuleCaches(mutate);
    },
    [fetch, mutate]
  );
};

export const useSetRuleActivation = () => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();

  return useCallback(
    async (id: string, dto: PostRuleActivationDto) => {
      const response = await fetch(`/rules/${id}/activation`, {
        method: 'PUT',
        body: JSON.stringify(dto),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => undefined);
        throw new Error(error?.message || 'Failed to update Rule activation.');
      }
      const result = await response.json();
      await revalidateRuleCaches(mutate, id);
      return result;
    },
    [fetch, mutate]
  );
};

export const useReplaceRuleAssignments = () => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();

  return useCallback(
    async (id: string, dto: ReplacePostRuleAssignmentsDto) => {
      const response = await fetch(`/rules/${id}/assignments`, {
        method: 'PUT',
        body: JSON.stringify(dto),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => undefined);
        throw new Error(error?.message || 'Failed to update Rule assignments.');
      }
      const result = await response.json();
      await revalidateRuleCaches(mutate, id);
      return result;
    },
    [fetch, mutate]
  );
};
