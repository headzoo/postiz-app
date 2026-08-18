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
Here are the things you can help with:
- Understanding follower triage categories (engaged, hot, mutual, costly, quiet, leads)
- Explaining relationship scores and follower insights
- Navigating follower lists and timelines
- General questions about audience management
`}
      initialMessage={t(
        'followers_assistant_initial_message',
        'Hi! I can help you work with your followers, lists, and relationship insights.'
      )}
    />
  );
};
