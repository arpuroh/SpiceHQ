import type { SupabaseClient } from '@supabase/supabase-js';
import { assessRecordQuality, type ReviewFlag } from '@/lib/data/record-quality';

export interface OrganizationRow {
  id: string;
  name: string;
  organization_type: string | null;
  headquarters: string | null;
  website: string | null;
  linkedin_url: string | null;
  tags: string[] | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  contact_count: number;
  fundraising_count: number;
  quality: 'verified' | 'review';
  review_flags: ReviewFlag[];
}

interface OrganizationQueryRow {
  id: string;
  name: string;
  organization_type: string | null;
  headquarters: string | null;
  website: string | null;
  linkedin_url: string | null;
  tags: string[] | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  contacts: Array<{ count: number }> | null;
  fundraising_accounts: Array<{ count: number }> | null;
}

export interface OrganizationPageData {
  source: 'supabase' | 'empty';
  totalOrganizations: number;
  verifiedOrganizations: number;
  reviewOrganizations: number;
  withContacts: number;
  withFundraising: number;
  rows: OrganizationRow[];
  reviewRows: OrganizationRow[];
}

export interface OrganizationDetailRow extends OrganizationRow {
  contacts: Array<{
    id: string;
    full_name: string | null;
    first_name: string;
    last_name: string | null;
    job_title: string | null;
    email: string | null;
    status: string | null;
  }>;
  fundraising_accounts: Array<{
    id: string;
    stage: string;
    status: string;
    target_commitment: number | null;
    committed_amount: number | null;
    soft_circled_amount: number | null;
    relationship_temperature: string | null;
  }>;
  interactions: Array<{
    id: string;
    interaction_type: string | null;
    subject: string | null;
    summary: string | null;
    occurred_at: string | null;
  }>;
}

export interface OrganizationDetailData {
  source: 'supabase' | 'empty';
  row: OrganizationDetailRow | null;
}

function normalizeOrganizationRow(row: OrganizationQueryRow): OrganizationRow {
  const quality = assessRecordQuality(
    [row.name, row.organization_type, row.headquarters, row.notes],
    { requireIdentity: true }
  );

  const contactCount = row.contacts?.[0]?.count ?? 0;
  const fundraisingCount = row.fundraising_accounts?.[0]?.count ?? 0;

  return {
    id: row.id,
    name: row.name,
    organization_type: row.organization_type,
    headquarters: row.headquarters,
    website: row.website,
    linkedin_url: row.linkedin_url,
    tags: row.tags,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    contact_count: contactCount,
    fundraising_count: fundraisingCount,
    quality: quality.quality,
    review_flags: quality.flags
  };
}

export function matchesOrganizationQuery(row: OrganizationRow, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const haystack = [
    row.name,
    row.organization_type,
    row.headquarters,
    row.tags?.join(' '),
    row.notes,
    row.website,
    row.linkedin_url
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export async function getOrganizationsPageData(supabase: SupabaseClient): Promise<OrganizationPageData> {
  const { data, error, count } = await supabase
    .from('organizations')
    .select(
      `
        id,
        name,
        organization_type,
        headquarters,
        website,
        linkedin_url,
        tags,
        notes,
        created_at,
        updated_at,
        contacts:contacts!contacts_primary_organization_id_fkey (count),
        fundraising_accounts:fundraising_accounts!fundraising_accounts_organization_id_fkey (count)
      `,
      { count: 'exact' }
    )
    .order('name')
    .limit(500);

  if (error) {
    return {
      source: 'empty',
      totalOrganizations: 0,
      verifiedOrganizations: 0,
      reviewOrganizations: 0,
      withContacts: 0,
      withFundraising: 0,
      rows: [],
      reviewRows: []
    };
  }

  const allRows = (data ?? []).map((row) => normalizeOrganizationRow(row as unknown as OrganizationQueryRow));
  const rows = allRows.filter((row) => row.quality === 'verified');
  const reviewRows = allRows.filter((row) => row.quality === 'review');

  return {
    source: allRows.length ? 'supabase' : 'empty',
    totalOrganizations: count ?? allRows.length,
    verifiedOrganizations: rows.length,
    reviewOrganizations: reviewRows.length,
    withContacts: rows.filter((row) => row.contact_count > 0).length,
    withFundraising: rows.filter((row) => row.fundraising_count > 0).length,
    rows,
    reviewRows
  };
}

export async function getOrganizationDetailData(supabase: SupabaseClient, organizationId: string): Promise<OrganizationDetailData> {
  const [
    { data: orgData, error: orgError },
    { data: contactsData },
    { data: fundraisingData },
    { data: interactionsData }
  ] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, organization_type, headquarters, website, linkedin_url, tags, notes, created_at, updated_at')
      .eq('id', organizationId)
      .maybeSingle(),
    supabase
      .from('contacts')
      .select('id, full_name, first_name, last_name, job_title, email, status')
      .eq('primary_organization_id', organizationId)
      .order('full_name')
      .limit(50),
    supabase
      .from('fundraising_accounts')
      .select('id, stage, status, target_commitment, committed_amount, soft_circled_amount, relationship_temperature')
      .eq('organization_id', organizationId)
      .limit(20),
    supabase
      .from('interaction_organizations')
      .select(`
        interaction:interactions!interaction_organizations_interaction_id_fkey (
          id,
          interaction_type,
          subject,
          summary,
          occurred_at
        )
      `)
      .eq('organization_id', organizationId)
      .limit(20)
  ]);

  if (orgError || !orgData) {
    return { source: 'empty', row: null };
  }

  const quality = assessRecordQuality(
    [orgData.name, orgData.organization_type, orgData.headquarters, orgData.notes],
    { requireIdentity: true }
  );

  const interactions = (interactionsData ?? [])
    .map((link: { interaction: unknown }) => {
      const interaction = Array.isArray(link.interaction) ? link.interaction[0] : link.interaction;
      return interaction as { id: string; interaction_type: string | null; subject: string | null; summary: string | null; occurred_at: string | null } | null;
    })
    .filter(Boolean) as OrganizationDetailRow['interactions'];

  interactions.sort((a, b) => {
    if (!a.occurred_at) return 1;
    if (!b.occurred_at) return -1;
    return new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime();
  });

  return {
    source: 'supabase',
    row: {
      ...orgData,
      contact_count: contactsData?.length ?? 0,
      fundraising_count: fundraisingData?.length ?? 0,
      quality: quality.quality,
      review_flags: quality.flags,
      contacts: (contactsData ?? []) as OrganizationDetailRow['contacts'],
      fundraising_accounts: (fundraisingData ?? []) as OrganizationDetailRow['fundraising_accounts'],
      interactions
    }
  };
}
