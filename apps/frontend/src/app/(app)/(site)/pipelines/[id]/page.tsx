import { PipelineDetailView } from '@gitroom/frontend/components/pipelines/pipeline.detail';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Pipeline`,
  description: '',
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <PipelineDetailView pipelineId={id} />;
}
