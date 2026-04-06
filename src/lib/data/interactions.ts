import type { SupabaseClient } from '@supabase/supabase-js';
import { formatDateTime } from '@/lib/data/contacts';
import { assessRecordQuality, type ReviewFlag } from '@/lib/data/record-quality';

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
  quality: 'verified' | 'review';
  review_flags: ReviewFlag[];
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
  verifiedInteractions: number;
  reviewInteractions: number;
  recentInteractions: number;
  withContacts: number;
  withOrganizations: number;
  rows: InteractionRow[];
  reviewRows: InteractionRow[];
}

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeInteractionRow(row: InteractionQueryRow): InteractionRow {
  const contacts = (row.contacts ?? []).map((contactLink) => ({
    ...contactLink,
    contact: firstRelated(contactLink.contact)
  }));
  const organizations = (row.organizations ?? []).map((organizationLink) => ({
    ...organizationLink,
    organization: firstRelated(organizationLink.organization)
  }));
  const fundraisingAccounts = (row.fundraising_accounts ?? []).map((accountLink) => ({
    fundraising_account: firstRelated(accountLink.fundraising_account)
  }));
  const quality = assessRecordQuality(
    [
      row.subject,
      row.summary,
      row.body_preview,
      row.source_system,
      ...contacts.map((contactLink) => contactLink.contact?.full_name ?? contactLink.contact?.first_name),
      ...organizations.map((organizationLink) => organizationLink.organization?.name)
    ],
    { requireIdentity: true }
  );

  return {
    ...row,
    contacts,
    organizations,
    fundraising_accounts: fundraisingAccounts,
    quality: quality.quality,
    review_flags: quality.flags
  };
}

export function formatInteractionSummary(row: InteractionRow): string {
  return row.summary ?? row.body_preview ?? row.subject ?? '—';
}

export function matchesInteractionQuery(row: InteractionRow, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return true;

  const haystack = [
    row.interaction_type,
    row.source_system,
    row.subject,
    row.summary,
    row.body_preview,
    ...row.contacts.map((contactLink) =>
      contactLink.contact?.full_name ?? [contactLink.contact?.first_name, contactLink.contact?.last_name].filter(Boolean).join(' ')
    ),
    ...row.organizations.map((organizationLink) => organizationLink.organization?.name),
    ...row.fundraising_accounts.map((accountLink) => accountLink.fundraising_account?.stage)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export async function getInteractionsPageData(supabase: SupabaseClient): Promise<InteractionPageData> {
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
    .limit(200);

  if (error) {
    return {
      source: 'empty',
      totalInteractions: 0,
      verifiedInteractions: 0,
      reviewInteractions: 0,
      recentInteractions: 0,
      withContacts: 0,
      withOrganizations: 0,
      rows: [],
      reviewRows: []
    };
  }

  const allRows = (data ?? []).map((row) => normalizeInteractionRow(row as InteractionQueryRow));
  const rows = allRows.filter((row) => row.quality === 'verified');
  const reviewRows = allRows.filter((row) => row.quality === 'review');
  const now = Date.now();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

  return {
    source: allRows.length ? 'supabase' : 'empty',
    totalInteractions: count ?? allRows.length,
    verifiedInteractions: rows.length,
    reviewInteractions: reviewRows.length,
    recentInteractions: rows.filter((row) => row.occurred_at && now - new Date(row.occurred_at).getTime() <= fourteenDaysMs).length,
    withContacts: rows.filter((row) => row.contacts.length > 0).length,
    withOrganizations: rows.filter((row) => row.organizations.length > 0).length,
    rows,
    reviewRows
  };
}

export { formatDateTime };
