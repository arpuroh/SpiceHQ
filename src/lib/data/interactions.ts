import type { SupabaseClient } from '@supabase/supabase-js';
import { formatDateTime } from '@/lib/data/contacts';
import { countActiveFilters, includesQuery, uniqueValues } from '@/lib/data/filters';

interface RelatedContact {
  id: string;
  full_name: string | null;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
}

interface RelatedOrganization {
  id: string;
  name: string;
}

interface RelatedFundraisingAccount {
  id: string;
  stage: string;
  status: string;
}

export interface InteractionRow {
  id: string;
  interaction_type: string | null;
  source_system: string | null;
  subject: string | null;
  summary: string | null;
  body_preview: string | null;
  occurred_at: string | null;
  contacts: Array<{
    relationship_role: string | null;
    contact: RelatedContact | null;
  }>;
  organizations: Array<{
    relationship_role: string | null;
    organization: RelatedOrganization | null;
  }>;
  fundraising_accounts: Array<{
    fundraising_account: RelatedFundraisingAccount | null;
  }>;
}

interface InteractionQueryRow extends Omit<InteractionRow, 'contacts' | 'organizations' | 'fundraising_accounts'> {
  contacts:
    | Array<{
        relationship_role: string | null;
        contact: RelatedContact | RelatedContact[] | null;
      }>
    | null;
  organizations:
    | Array<{
        relationship_role: string | null;
        organization: RelatedOrganization | RelatedOrganization[] | null;
      }>
    | null;
  fundraising_accounts:
    | Array<{
        fundraising_account: RelatedFundraisingAccount | RelatedFundraisingAccount[] | null;
      }>
    | null;
}

export interface InteractionPageData {
  source: 'supabase' | 'empty';
  totalInteractions: number;
  filteredInteractions: number;
  recentInteractions: number;
  withContacts: number;
  withOrganizations: number;
  rows: InteractionRow[];
  filterOptions: {
    interactionTypes: string[];
    sourceSystems: string[];
    accountStages: string[];
  };
  activeFilterCount: number;
}

export interface InteractionFilters {
  query: string | null;
  interactionType: string | null;
  sourceSystem: string | null;
  accountStage: string | null;
  fromDate: string | null;
  toDate: string | null;
}

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeInteractionRow(row: InteractionQueryRow): InteractionRow {
  return {
    ...row,
    contacts: (row.contacts ?? []).map((contactLink) => ({
      ...contactLink,
      contact: firstRelated(contactLink.contact)
    })),
    organizations: (row.organizations ?? []).map((organizationLink) => ({
      ...organizationLink,
      organization: firstRelated(organizationLink.organization)
    })),
    fundraising_accounts: (row.fundraising_accounts ?? []).map((accountLink) => ({
      fundraising_account: firstRelated(accountLink.fundraising_account)
    }))
  };
}

export function formatInteractionSummary(row: InteractionRow): string {
  return row.summary ?? row.body_preview ?? row.subject ?? '—';
}

export async function getInteractionsPageData(
  supabase: SupabaseClient,
  filters: InteractionFilters
): Promise<InteractionPageData> {
  const { data, error, count } = await supabase
    .from('interactions')
    .select(
      `
        id,
        interaction_type,
        source_system,
        subject,
        summary,
        body_preview,
        occurred_at,
        contacts:interaction_contacts (
          relationship_role,
          contact:contacts!interaction_contacts_contact_id_fkey (
            id,
            full_name,
            first_name,
            last_name,
            job_title
          )
        ),
        organizations:interaction_organizations (
          relationship_role,
          organization:organizations!interaction_organizations_organization_id_fkey (
            id,
            name
          )
        ),
        fundraising_accounts:interaction_fundraising_accounts (
          fundraising_account:fundraising_accounts!interaction_fundraising_accounts_fundraising_account_id_fkey (
            id,
            stage,
            status
          )
        )
      `,
      { count: 'exact' }
    )
    .order('occurred_at', { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) {
    return {
      source: 'empty',
      totalInteractions: 0,
      filteredInteractions: 0,
      recentInteractions: 0,
      withContacts: 0,
      withOrganizations: 0,
      rows: [],
      filterOptions: {
        interactionTypes: [],
        sourceSystems: [],
        accountStages: []
      },
      activeFilterCount: 0
    };
  }

  const allRows = (data ?? []).map((row) => normalizeInteractionRow(row as InteractionQueryRow));
  const fromDate = filters.fromDate ? new Date(`${filters.fromDate}T00:00:00`) : null;
  const toDate = filters.toDate ? new Date(`${filters.toDate}T23:59:59.999`) : null;
  const rows = allRows.filter((row) => {
    const contactNames = row.contacts.flatMap((contactLink) => [
      contactLink.contact?.full_name,
      contactLink.contact?.first_name,
      contactLink.contact?.last_name,
      contactLink.contact?.job_title
    ]);
    const organizationNames = row.organizations.map((organizationLink) => organizationLink.organization?.name);
    const accountStages = row.fundraising_accounts.map((accountLink) => accountLink.fundraising_account?.stage);
    const accountStatuses = row.fundraising_accounts.map((accountLink) => accountLink.fundraising_account?.status);

    if (!includesQuery([
      row.subject,
      row.summary,
      row.body_preview,
      row.interaction_type,
      row.source_system,
      ...contactNames,
      ...organizationNames,
      ...accountStages,
      ...accountStatuses
    ], filters.query)) {
      return false;
    }

    if (filters.interactionType && row.interaction_type !== filters.interactionType) return false;
    if (filters.sourceSystem && row.source_system !== filters.sourceSystem) return false;
    if (
      filters.accountStage &&
      !row.fundraising_accounts.some((accountLink) => accountLink.fundraising_account?.stage === filters.accountStage)
    ) {
      return false;
    }

    if (fromDate || toDate) {
      if (!row.occurred_at) return false;
      const occurredAt = new Date(row.occurred_at);
      if (fromDate && occurredAt < fromDate) return false;
      if (toDate && occurredAt > toDate) return false;
    }

    return true;
  });
  const now = Date.now();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

  return {
    source: rows.length ? 'supabase' : 'empty',
    totalInteractions: count ?? allRows.length,
    filteredInteractions: rows.length,
    recentInteractions: rows.filter((row) => row.occurred_at && now - new Date(row.occurred_at).getTime() <= fourteenDaysMs).length,
    withContacts: rows.filter((row) => row.contacts.length > 0).length,
    withOrganizations: rows.filter((row) => row.organizations.length > 0).length,
    rows,
    filterOptions: {
      interactionTypes: uniqueValues(allRows.map((row) => row.interaction_type)),
      sourceSystems: uniqueValues(allRows.map((row) => row.source_system)),
      accountStages: uniqueValues(
        allRows.flatMap((row) => row.fundraising_accounts.map((accountLink) => accountLink.fundraising_account?.stage))
      )
    },
    activeFilterCount: countActiveFilters([
      filters.query,
      filters.interactionType,
      filters.sourceSystem,
      filters.accountStage,
      filters.fromDate,
      filters.toDate
    ])
  };
}

export { formatDateTime };
