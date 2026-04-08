import type { SupabaseClient } from '@supabase/supabase-js';
import { assessRecordQuality, type ReviewFlag } from '@/lib/data/record-quality';

export interface OrganizationRow {
  id: string;
  name: string;
  organization_type: string | null;
  headquarters: string | null;
  website: string | null;
  linkedin_url: string | null;
  preferred_channel: string | null;
  tags: string[] | null;
  sector_focus: string[] | null;
  description: string | null;
  internal_notes: string | null;
  relationship_status: string | null;
  created_at: string | null;
  updated_at: string | null;
  contact_count: number;
  fundraising_count: number;
  interaction_count: number;
  task_count: number;
  note_count: number;
  portfolio_count: number;
  last_interaction_at: string | null;
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
  preferred_channel: string | null;
  tags: string[] | null;
  sector_focus: string[] | null;
  description: string | null;
  internal_notes: string | null;
  relationship_status: string | null;
  created_at: string | null;
  updated_at: string | null;
  contacts: Array<{ count: number }> | null;
  fundraising_accounts: Array<{ count: number }> | null;
  interaction_organizations: Array<{ count: number }> | null;
  tasks: Array<{ count: number }> | null;
  note_links: Array<{ count: number }> | null;
  portfolio_companies: Array<{ count: number }> | null;
  latest_interactions: Array<{ occurred_at: string | null }> | null;
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
    source_system: string | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string | null;
    priority: string | null;
    due_at: string | null;
  }>;
  notes: Array<{
    id: string;
    title: string | null;
    note_type: string | null;
    pinned: boolean | null;
    created_at: string | null;
    body: string | null;
  }>;
  portfolio_companies: Array<{
    id: string;
    company_name: string;
    stage: string | null;
    status: string | null;
    investment_amount: number | null;
    current_valuation: number | null;
  }>;
}

export interface OrganizationDetailData {
  source: 'supabase' | 'empty';
  row: OrganizationDetailRow | null;
}

function normalizeOrganizationRow(row: OrganizationQueryRow): OrganizationRow {
  const quality = assessRecordQuality(
    [row.name, row.organization_type, row.headquarters, row.description],
    { requireIdentity: true }
  );

  const contactCount = row.contacts?.[0]?.count ?? 0;
  const fundraisingCount = row.fundraising_accounts?.[0]?.count ?? 0;
  const interactionCount = row.interaction_organizations?.[0]?.count ?? 0;
  const taskCount = row.tasks?.[0]?.count ?? 0;
  const noteCount = row.note_links?.[0]?.count ?? 0;
  const portfolioCount = row.portfolio_companies?.[0]?.count ?? 0;
  const lastInteractionAt = row.latest_interactions?.[0]?.occurred_at ?? null;

  return {
    id: row.id,
    name: row.name,
    organization_type: row.organization_type,
    headquarters: row.headquarters,
    website: row.website,
    linkedin_url: row.linkedin_url,
    preferred_channel: row.preferred_channel,
    tags: row.tags,
    sector_focus: row.sector_focus,
    description: row.description,
    internal_notes: row.internal_notes,
    relationship_status: row.relationship_status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    contact_count: contactCount,
    fundraising_count: fundraisingCount,
    interaction_count: interactionCount,
    task_count: taskCount,
    note_count: noteCount,
    portfolio_count: portfolioCount,
    last_interaction_at: lastInteractionAt,
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
    row.description,
    row.internal_notes,
    row.website,
    row.linkedin_url,
    row.preferred_channel,
    row.relationship_status
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
        preferred_channel,
        tags,
        description,
        internal_notes:notes,
        relationship_status,
        sector_focus,
        created_at,
        updated_at,
        contacts:contacts!contacts_primary_organization_id_fkey (count),
        fundraising_accounts:fundraising_accounts!fundraising_accounts_organization_id_fkey (count),
        interaction_organizations:interaction_organizations!interaction_organizations_organization_id_fkey (count),
        tasks:tasks!tasks_organization_id_fkey (count),
        note_links:notes!notes_organization_id_fkey (count),
        portfolio_companies:portfolio_companies!portfolio_companies_organization_id_fkey (count),
        latest_interactions:interaction_organizations!interaction_organizations_organization_id_fkey (
          interaction:interactions!interaction_organizations_interaction_id_fkey (occurred_at)
        )
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

  const normalizedRows = (data ?? []).map((row) => {
    const normalized = row as unknown as OrganizationQueryRow & {
      latest_interactions?: Array<{ interaction?: { occurred_at: string | null } | Array<{ occurred_at: string | null }> | null }> | null;
    };

    const latestInteractions = (normalized.latest_interactions ?? [])
      .map((link) => {
        const nestedLink = link as { interaction?: { occurred_at: string | null } | Array<{ occurred_at: string | null }> | null };
        const interaction = Array.isArray(nestedLink.interaction) ? nestedLink.interaction[0] : nestedLink.interaction;
        return interaction?.occurred_at ?? null;
      })
      .filter(Boolean)
      .sort((a, b) => new Date(String(b)).getTime() - new Date(String(a)).getTime());

    return normalizeOrganizationRow({
      ...normalized,
      latest_interactions: latestInteractions.length ? [{ occurred_at: latestInteractions[0] }] : []
    });
  });

  const allRows = normalizedRows.sort((a, b) => {
    const scoreA = a.contact_count + a.fundraising_count + a.interaction_count + a.task_count + a.note_count + a.portfolio_count;
    const scoreB = b.contact_count + b.fundraising_count + b.interaction_count + b.task_count + b.note_count + b.portfolio_count;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.name.localeCompare(b.name);
  });
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
    { data: interactionsData },
    { data: tasksData },
    { data: notesData },
    { data: portfolioData }
  ] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, organization_type, headquarters, website, linkedin_url, preferred_channel, tags, sector_focus, description, internal_notes:notes, relationship_status, created_at, updated_at')
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
          occurred_at,
          source_system
        )
      `)
      .eq('organization_id', organizationId)
      .limit(20),
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_at')
      .eq('organization_id', organizationId)
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(20),
    supabase
      .from('notes')
      .select('id, title, note_type, pinned, created_at, body')
      .eq('organization_id', organizationId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('portfolio_companies')
      .select('id, company_name, stage, status, investment_amount, current_valuation')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(20)
  ]);

  if (orgError || !orgData) {
    return { source: 'empty', row: null };
  }

  const quality = assessRecordQuality(
    [orgData.name, orgData.organization_type, orgData.headquarters, orgData.description],
    { requireIdentity: true }
  );

  const interactions = (interactionsData ?? [])
    .map((link: { interaction: unknown }) => {
      const interaction = Array.isArray(link.interaction) ? link.interaction[0] : link.interaction;
      return interaction as { id: string; interaction_type: string | null; subject: string | null; summary: string | null; occurred_at: string | null; source_system: string | null } | null;
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
      interaction_count: interactions.length,
      task_count: tasksData?.length ?? 0,
      note_count: notesData?.length ?? 0,
      portfolio_count: portfolioData?.length ?? 0,
      last_interaction_at: interactions[0]?.occurred_at ?? null,
      quality: quality.quality,
      review_flags: quality.flags,
      contacts: (contactsData ?? []) as OrganizationDetailRow['contacts'],
      fundraising_accounts: (fundraisingData ?? []) as OrganizationDetailRow['fundraising_accounts'],
      interactions,
      tasks: (tasksData ?? []) as OrganizationDetailRow['tasks'],
      notes: (notesData ?? []) as OrganizationDetailRow['notes'],
      portfolio_companies: (portfolioData ?? []) as OrganizationDetailRow['portfolio_companies']
    }
  };
}
