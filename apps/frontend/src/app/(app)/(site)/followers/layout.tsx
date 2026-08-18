import { ReactNode } from 'react';
import { FollowersAssistant } from '@gitroom/frontend/components/followers/followers.assistant';

export default function FollowersLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <FollowersAssistant />
    </>
  );
}
