'use client';

import { FC } from 'react';
import { CopilotPopup } from '@copilotkit/react-ui';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

type CopilotAssistantPopupProps = {
  instructions: string;
  initialMessage?: string;
};

export const CopilotAssistantPopup: FC<CopilotAssistantPopupProps> = ({
  instructions,
  initialMessage,
}) => {
  const t = useT();

  return (
    <CopilotPopup
      hitEscapeToClose={false}
      clickOutsideToClose={true}
      instructions={instructions}
      labels={{
        title: t('your_assistant', 'Your Assistant'),
        initial:
          initialMessage ??
          t(
            'assistant_initial_message',
            'Hi! I can help you to refine your social media posts.'
          ),
      }}
    />
  );
};
