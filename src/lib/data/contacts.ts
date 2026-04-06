import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReviewFlag } from '@/lib/data/record-quality';
import { countActiveFilters, includesQuery, uniqueValues } from '@/lib/data/filters';

export interface ContactOrganization {
  id: string;
  name: string;
  organization_type: string | null;
  headquarters: string | null;
}

export interface ContactRow {
  id: string;
  full_name: string | null;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  preferred_channel: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
  quality?: 'verified' | 'review';
  review_flags?: ReviewFlag[];
  primary_organization: ContactOrganization | null;
  organizations: Array<{
    is_primary: boolean | null;
    relationship_type: string | null;
    title: string | null;
    organization: ContactOrganization | null;
  }>;
}

interface ContactQueryRow extends Omit<ContactRow, 'primary_organization' | 'organizations'> {
  primary_organization: ContactOrganization | ContactOrganization[] | null;
  organizations:
    | Array<{
        is_primary: boolean | null;
        relationship_type: string | null;
        title: string | null;
        organization: ContactOrganization | ContactOrganization[] | null;
      }>
    | null;
}

export interface ContactPageData {
  source: 'supabase' | 'empty';
  totalContacts: number;
  filteredContacts: number;
  linkedOrganizations: number;
  withEmail: number;
  recentlyAdded: number;
  rows: ContactRow[];
  organizationOptions: ContactOrganization[];
  filterOptions: {
    statuses: string[];
    organizationTypes: string[];
  };
  activeFilterCount: number;
}

export interface ContactFilters {
  query: string | null;
  status: string | null;
  organizationType: string | null;
  hasEmail: boolean;
  hasLinkedin: boolean;
}

export interface ContactDetailData {
  source: 'supabase' | 'empty';
  row: ContactRow | null;
  organizationOptions: ContactOrganization[];
}

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeContactRow(row: ContactQueryRow): ContactRow {
  return {
    ...row,
    primary_organization: firstRelated(row.primary_organization),
    quality: 'verified',
    review_flags: [],
    organizations: (row.organizations ?? []).map((organizationLink) => ({
      ...organizationLink,
      organization: firstRelated(organizationLink.organization)
    }))
  };
}

const contactSelect = `
  id,
  full_name,
  first_name,
  last_name,
  job_title,
  email,
  phone,
  linkedin_url,
  preferred_channel,
  status,
  notes,
  created_at,
  primary_organization:organizations!contacts_primary_organization_id_fkey (
    id,
    name,
    organization_type,
    headquarters
  ),
  organizations:contact_organizations (
    is_primary,
    relationship_type,
    title,
    organization:organizations!contact_organizations_organization_id_fkey (
      id,
      name,
      organization_type,
      headquarters
    )
  )
`;

export function formatDateTime(value: string | null): string {
  if (!value) return '—';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

export async function getContactsPageData(
  supabase: SupabaseClient,
  filters: ContactFilters
): Promise<ContactPageData> {
  const [{ data: contactsData, error: contactsError, count }, { data: organizationsData, error: organizationsError }] =
    await Promise.all([
      supabase
        .from('contacts')
        .select(contactSelect, { count: 'exact' })
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(500),
      supabase
        .from('organizations')
        .select('id, name, organization_type, headquarters')
        .order('name')
        .limit(500)
    ]);

  if (contactsError || organizationsError) {
    return {
      source: 'empty',
      totalContacts: 0,
      filteredContacts: 0,
      linkedOrganizations: 0,
      withEmail: 0,
      recentlyAdded: 0,
      rows: [],
      organizationOptions: [],
      filterOptions: {
        statuses: [],
        organizationTypes: []
      },
      activeFilterCount: 0
    };
  }

  const allRows = (contactsData ?? []).map((row) => normalizeContactRow(row as ContactQueryRow));
  const rows = allRows.filter((row) => {
    const relatedOrganizationNames = row.organizations.map((organizationLink) => organizationLink.organization?.name);
    const relatedOrganizationTypes = row.organizations.map((organizationLink) => organizationLink.organization?.organization_type);

    if (!includesQuery([
      row.full_name,
      row.first_name,
      row.last_name,
      row.job_title,
      row.email,
      row.phone,
      row.notes,
      row.status,
      row.preferred_channel,
      row.primary_organization?.name,
      row.primary_organization?.organization_type,
      ...relatedOrganizationNames,
      ...relatedOrganizationTypes
    ], filters.query)) {
      return false;
    }

    if (filters.status && row.status !== filters.status) return false;

    if (
      filters.organizationType &&
      row.primary_organization?.organization_type !== filters.organizationType &&
      !row.organizations.some((organizationLink) => organizationLink.organization?.organization_type === filters.organizationType)
    ) {
      return false;
    }

    if (filters.hasEmail && !row.email) return false;
    if (filters.hasLinkedin && !row.linkedin_url) return false;

    return true;
  });
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  return {
    source: rows.length ? 'supabase' : 'empty',
    totalContacts: count ?? allRows.length,
    filteredContacts: rows.length,
    linkedOrganizations: rows.filter((row) => row.primary_organization || row.organizations.length > 0).length,
    withEmail: rows.filter((row) => row.email).length,
    recentlyAdded: rows.filter((row) => row.created_at && now - new Date(row.created_at).getTime() <= thirtyDaysMs).length,
    rows,
    organizationOptions: (organizationsData ?? []) as ContactOrganization[],
    filterOptions: {
      statuses: uniqueValues(allRows.map((row) => row.status)),
      organizationTypes: uniqueValues([
        ...allRows.map((row) => row.primary_organization?.organization_type),
        ...allRows.flatMap((row) => row.organizations.map((organizationLink) => organizationLink.organization?.organization_type))
      ])
    },
    activeFilterCount: countActiveFilters([
      filters.query,
      filters.status,
      filters.organizationType,
      filters.hasEmail,
      filters.hasLinkedin
    ])
  };
}

export async function getContactDetailData(supabase: SupabaseClient, contactId: string): Promise<ContactDetailData> {
  const [{ data: contactData, error: contactError }, { data: organizationsData, error: organizationsError }] =
    await Promise.all([
      supabase.from('contacts').select(contactSelect).eq('id', contactId).maybeSingle(),
      supabase
        .from('organizations')
        .select('id, name, organization_type, headquarters')
        .order('name')
        .limit(500)
    ]);

  if (contactError || organizationsError || !contactData) {
    return {
      source: 'empty',
      row: null,
      organizationOptions: []
    };
  }

  return {
    source: 'supabase',
    row: normalizeContactRow(contactData as ContactQueryRow),
    organizationOptions: (organizationsData ?? []) as ContactOrganization[]
  };
}

export function getContactDisplayName(contact: { full_name?: string | null; first_name?: string | null; last_name?: string | null }) {
  const fullName = contact.full_name?.trim();
  if (fullName) return fullName;
  const joined = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim();
  return joined || 'Unknown contact';
}
