import { ContinueTrackingAuthorization } from '@gitroom/frontend/components/settings/continue.tracking.authorization';

export const dynamic = 'force-dynamic';

export default async function Page(props: { searchParams: Promise<any> }) {
  const searchParams = await props.searchParams;
  return <ContinueTrackingAuthorization searchParams={searchParams} />;
}
