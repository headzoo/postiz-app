export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { FollowersComponent } from '@gitroom/frontend/components/followers/followers.component';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Followers`,
  description: '',
};

export default async function Index() {
  return <FollowersComponent />;
}
