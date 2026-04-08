import { redirect } from 'next/navigation';

type OrganizationDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getQueryParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function LegacyContactOrganizationDetailPage({ params, searchParams }: OrganizationDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const created = getQueryParam(resolvedSearchParams.created);
  const error = getQueryParam(resolvedSearchParams.error);
  const nextSearch = new URLSearchParams();

  if (created) nextSearch.set('created', created);
  if (error) nextSearch.set('error', error);

  const query = nextSearch.toString();
  redirect(`/app/organizations/${id}${query ? `?${query}` : ''}`);
}
