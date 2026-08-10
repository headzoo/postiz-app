export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { Dashboard } from '@gitroom/frontend/components/dashboard/dashboard.component';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Dashboard`,
  description: '',
};

export default async function DashboardPage() {
  return <Dashboard />;
}
