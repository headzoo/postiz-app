import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
import { PipelineGlobalSchedule } from '@gitroom/frontend/components/pipelines/pipeline.global.schedule';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'P++' : 'Gitroom'} Pipeline Schedule`,
  description: 'View Pipeline recurring schedules for the current week.',
};

export default async function Page() {
  return <PipelineGlobalSchedule />;
}
