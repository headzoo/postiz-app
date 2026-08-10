import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

function buildCalendarRedirectUrl(
  searchParams: Record<string, string | string[] | undefined>
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
      continue;
    }

    query.set(key, value);
  }

  const serialized = query.toString();
  return serialized ? `/calendar?${serialized}` : '/calendar';
}

export default async function LaunchesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirect(buildCalendarRedirectUrl(params));
}
