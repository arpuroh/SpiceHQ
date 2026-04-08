import type { SupabaseClient } from '@supabase/supabase-js';
import { formatDateTime } from '@/lib/data/contacts';
import {
  curateInteractionLikeRecord,
  curateRecords,
  type CuratedReason
} from '@/lib/data/curation';

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
  visibleInteractions: number;
  hiddenInteractions: number;
  recentInteractions: number;
  withContacts: number;
  withOrganizations: number;
  rows: InteractionRow[];
  hiddenRows: Array<{
    row: InteractionRow;
    reasons: CuratedReason[];
  }>;
  organizationOptions: Array<{ id: string; name: string }>;
}

export function getInteractionContactName(contact: RelatedContact | null): string {
  if (!contact) return 'Unknown contact';
  return contact.full_name ?? (`${contact.first_name} ${contact.last_name ?? ''}`.trim() || 'Unknown contact');
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

export async function getInteractionsPageData(supabase: SupabaseClient): Promise<InteractionPageData> {
  const [{ data, error, count }, { data: organizationsData }] = await Promise.all([
    supabase
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
    .limit(200),
    supabase
      .from('organizations')
      .select('id, name')
      .order('name')
  ]);

  if (error) {
    return {
      source: 'empty',
      totalInteractions: 0,
      visibleInteractions: 0,
      hiddenInteractions: 0,
      recentInteractions: 0,
      withContacts: 0,
      withOrganizations: 0,
      rows: [],
      hiddenRows: [],
      organizationOptions: organizationsData ?? []
    };
  }

  const allRows = (data ?? []).map((row) => normalizeInteractionRow(row as InteractionQueryRow));
  const curated = curateRecords(allRows, (row) => {
    const contactNames = row.contacts
      .map((contactLink) => contactLink.contact?.full_name ?? [contactLink.contact?.first_name, contactLink.contact?.last_name].filter(Boolean).join(' '))
      .filter(Boolean);
    const organizationNames = row.organizations
      .map((organizationLink) => organizationLink.organization?.name)
      .filter(Boolean);
    const evaluation = curateInteractionLikeRecord({
      markerValues: [
        row.interaction_type,
        row.source_system,
        row.subject,
        row.summary,
        row.body_preview,
        ...contactNames,
        ...organizationNames
      ],
      hasOccurredAt: Boolean(row.occurred_at),
      hasSummary: Boolean(row.subject?.trim() || row.summary?.trim() || row.body_preview?.trim()),
      hasLinkedSubjects: Boolean(contactNames.length || organizationNames.length),
      hasFundraisingLink: Boolean(row.fundraising_accounts.some((accountLink) => accountLink.fundraising_account)),
      hasSource: Boolean(row.source_system)
    });

    return {
      row,
      ...evaluation
    };
  });
  const rows = curated.visible.map((item) => item.row);
  const now = Date.now();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

  return {
    source: allRows.length ? 'supabase' : 'empty',
    totalInteractions: count ?? allRows.length,
    visibleInteractions: rows.length,
    hiddenInteractions: curated.hidden.length,
    recentInteractions: rows.filter((row) => row.occurred_at && now - new Date(row.occurred_at).getTime() <= fourteenDaysMs).length,
    withContacts: rows.filter((row) => row.contacts.length > 0).length,
    withOrganizations: rows.filter((row) => row.organizations.length > 0).length,
    rows,
    hiddenRows: curated.hidden.map((item) => ({
      row: item.row,
      reasons: item.reasons
    })),
    organizationOptions: organizationsData ?? []
  };
}

export { formatDateTime };
