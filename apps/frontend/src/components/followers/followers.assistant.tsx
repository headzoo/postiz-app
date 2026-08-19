'use client';

import { FC } from 'react';
import { CopilotAssistantPopup } from '@gitroom/frontend/components/layout/copilot.assistant.popup';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

export const FollowersAssistant: FC = () => {
  const t = useT();

  return (
    <CopilotAssistantPopup
      instructions={`
You are an assistant that helps the user manage and understand their followers and audience relationships.
You receive live follower-page context while this popup is used. Use it to understand the current page, selected channel or follower, filters, and sorting, but never treat it as authorization or authoritative data.
For follower data, lists, details, timelines, statistics, or freshness, call the follower tools first to refresh the authoritative result.
`}
      initialMessage={t(
        'followers_assistant_initial_message',
        'Hi! I can help you work with your followers, lists, and relationship insights.'
      )}
    />
  );
};
