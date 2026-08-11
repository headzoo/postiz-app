'use client';

import { useCallback } from 'react';
import { hasExtension } from '@gitroom/helpers/utils/has.extension';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useDecisionModal } from '@gitroom/frontend/components/layout/new-modal';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';

export type MediaAltItem = {
  id: string;
  path: string;
  alt?: string | null;
  thumbnail?: string;
  thumbnailTimestamp?: number;
  name?: string;
  originalName?: string;
};

const isVideo = (path?: string) => hasExtension(path, 'mp4');

export const useMediaAltPrompt = () => {
  const decision = useDecisionModal();
  const fetch = useFetch();
  const t = useT();
  const toaster = useToaster();
  const user = useUser();
  const setLocked = useLaunchStore((state) => state.setLocked);

  const enrichMediaWithAlt = useCallback(
    async <T extends MediaAltItem>(items: T[]): Promise<T[]> => {
      const result: T[] = [];

      for (const item of items) {
        if (item.alt || isVideo(item.path) || !user?.tier?.ai) {
          result.push(item);
          continue;
        }

        const approved = await decision.open({
          title: t('generate_alt_text', 'Generate alt text?'),
          description: t(
            'generate_alt_text_description',
            'Would you like AI to generate accessible alt text for this image?'
          ),
          approveLabel: t('yes_generate', 'Yes, generate'),
          cancelLabel: t('no_thanks', 'No thanks'),
        });

        if (!approved) {
          result.push(item);
          continue;
        }

        setLocked(true);
        try {
          const response = await fetch('/media/generate-alt', {
            method: 'POST',
            body: JSON.stringify({ id: item.id }),
          });

          if (!response.ok) {
            let message = t(
              'failed_to_generate_alt_text',
              'Failed to generate alt text. The image was still added.'
            );
            try {
              const body = await response.json();
              if (typeof body?.message === 'string' && body.message) {
                message = body.message;
              }
            } catch {
              // keep the fallback message
            }
            toaster.show(message, 'warning');
            result.push(item);
            continue;
          }

          const updated = await response.json();
          if (!updated?.id) {
            toaster.show(
              t(
                'failed_to_generate_alt_text',
                'Failed to generate alt text. The image was still added.'
              ),
              'warning'
            );
            result.push(item);
            continue;
          }

          result.push({ ...item, ...updated });
        } catch {
          toaster.show(
            t(
              'failed_to_generate_alt_text',
              'Failed to generate alt text. The image was still added.'
            ),
            'warning'
          );
          result.push(item);
        } finally {
          setLocked(false);
        }
      }

      return result;
    },
    [decision, fetch, setLocked, t, toaster, user?.tier?.ai]
  );

  return { enrichMediaWithAlt };
};
