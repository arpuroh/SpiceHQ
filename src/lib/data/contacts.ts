import type { SupabaseClient } from '@supabase/supabase-js';
import { curateContactLikeRecord, curateRecords, type CuratedReason } from '@/lib/data/curation';

export interface ContactOrganization {
  id: string;
  name: string;
  organization_type: string | null;
  headquarters: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  preferred_channel?: string | null;
  notes?: string | null;
  created_at?: string | null;
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
  primary_organization: ContactOrganization | null;
  organizations: Array<{
    is_primary: boolean | null;
    relationship_type: string | null;
    title: string | null;
    organization: ContactOrganization | null;
  }>;
}

export interface OrganizationContactRow {
  is_primary: boolean | null;
  relationship_type: string | null;
  title: string | null;
  contact: Pick<ContactRow, 'id' | 'full_name' | 'first_name' | 'last_name' | 'email' | 'linkedin_url' | 'status'> | null;
}

export interface OrganizationDetailData {
  source: 'supabase' | 'empty';
  row: ContactOrganization | null;
  relatedContacts: OrganizationContactRow[];
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

interface OrganizationQueryRow extends ContactOrganization {
  related_contacts:
    | Array<{
        is_primary: boolean | null;
        relationship_type: string | null;
        title: string | null;
        contact:
          | Pick<ContactRow, 'id' | 'full_name' | 'first_name' | 'last_name' | 'email' | 'linkedin_url' | 'status'>
          | Pick<ContactRow, 'id' | 'full_name' | 'first_name' | 'last_name' | 'email' | 'linkedin_url' | 'status'>[]
          | null;
      }>
    | null;
}

export interface ContactPageData {
  source: 'supabase' | 'empty';
  totalContacts: number;
  visibleContacts: number;
  hiddenContacts: number;
  linkedOrganizations: number;
  withEmail: number;
  recentlyAdded: number;
  rows: ContactRow[];
  organizationOptions: ContactOrganization[];
  recentOrganizations: ContactOrganization[];
  hiddenRows: Array<{
    row: ContactRow;
    reasons: CuratedReason[];
  }>;
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
    organizations: (row.organizations ?? []).map((organizationLink) => ({
      ...organizationLink,
      organization: firstRelated(organizationLink.organization)
    }))
  };
}

function normalizeOrganizationContactRow(row: OrganizationQueryRow): OrganizationDetailData {
  return {
    source: 'supabase',
    row,
    relatedContacts: (row.related_contacts ?? []).map((contactLink) => ({
      ...contactLink,
      contact: firstRelated(contactLink.contact)
    }))
  };
}

const organizationSelect = 'id, name, organization_type, headquarters, website, linkedin_url, preferred_channel, notes, created_at';

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
    ${organizationSelect}
  ),
  organizations:contact_organizations (
    is_primary,
    relationship_type,
    title,
    organization:organizations!contact_organizations_organization_id_fkey (
      ${organizationSelect}
    )
  )
`;

const organizationDetailSelect = `
  ${organizationSelect},
  related_contacts:contact_organizations (
    is_primary,
    relationship_type,
    title,
    contact:contacts!contact_organizations_contact_id_fkey (
      id,
      full_name,
      first_name,
      last_name,
      email,
      linkedin_url,
      status
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

export function matchesContactQuery(row: ContactRow, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const haystack = [
    row.full_name,
    row.first_name,
    row.last_name,
    row.job_title,
    row.email,
    row.phone,
    row.linkedin_url,
    row.preferred_channel,
    row.status,
    row.notes,
    row.primary_organization?.name,
    ...row.organizations.map((organizationLink) => organizationLink.organization?.name)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export async function getContactsPageData(supabase: SupabaseClient): Promise<ContactPageData> {
  const [
    { data: contactsData, error: contactsError, count },
    { data: organizationsData, error: organizationsError },
    { data: recentOrganizationsData, error: recentOrganizationsError }
  ] = await Promise.all([
    supabase
      .from('contacts')
      .select(contactSelect, { count: 'exact' })
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(200),
    supabase
      .from('organizations')
      .select(organizationSelect)
      .order('name')
      .limit(500),
    supabase
      .from('organizations')
      .select(organizationSelect)
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(8)
  ]);

  if (contactsError || organizationsError || recentOrganizationsError) {
    return {
      source: 'empty',
      totalContacts: 0,
      visibleContacts: 0,
      hiddenContacts: 0,
      linkedOrganizations: 0,
      withEmail: 0,
      recentlyAdded: 0,
      rows: [],
      organizationOptions: [],
      recentOrganizations: [],
      hiddenRows: []
    };
  }

  const allRows = (contactsData ?? []).map((row) => normalizeContactRow(row as ContactQueryRow));
  const curated = curateRecords(allRows, (row) => {
    const evaluation = curateContactLikeRecord({
      identityValues: [row.full_name, row.first_name, row.last_name],
      markerValues: [
        row.full_name,
        row.first_name,
        row.last_name,
        row.job_title,
        row.email,
        row.phone,
        row.linkedin_url,
        row.preferred_channel,
        row.status,
        row.notes,
        row.primary_organization?.name,
        ...row.organizations.map((organizationLink) => organizationLink.organization?.name)
      ],
      hasDirectContactMethod: Boolean(row.email || row.phone || row.linkedin_url),
      hasProfessionalContext: Boolean(row.job_title || row.preferred_channel || row.status),
      hasOrganizationLink: Boolean(row.primary_organization || row.organizations.some((organizationLink) => organizationLink.organization)),
      status: row.status,
      hasNotes: Boolean(row.notes?.trim())
    });

    return {
      row,
      ...evaluation
    };
  });
  const rows = curated.visible.map((item) => item.row);
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  return {
    source: allRows.length ? 'supabase' : 'empty',
    totalContacts: count ?? allRows.length,
    visibleContacts: rows.length,
    hiddenContacts: curated.hidden.length,
    linkedOrganizations: rows.filter((row) => row.primary_organization || row.organizations.length > 0).length,
    withEmail: rows.filter((row) => row.email).length,
    recentlyAdded: rows.filter((row) => row.created_at && now - new Date(row.created_at).getTime() <= thirtyDaysMs).length,
    rows,
    organizationOptions: (organizationsData ?? []) as ContactOrganization[],
    recentOrganizations: (recentOrganizationsData ?? []) as ContactOrganization[],
    hiddenRows: curated.hidden.map((item) => ({
      row: item.row,
      reasons: item.reasons
    }))
  };
}

export async function getContactDetailData(supabase: SupabaseClient, contactId: string): Promise<ContactDetailData> {
  const [{ data: contactData, error: contactError }, { data: organizationsData, error: organizationsError }] =
    await Promise.all([
      supabase.from('contacts').select(contactSelect).eq('id', contactId).maybeSingle(),
      supabase
        .from('organizations')
        .select(organizationSelect)
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

export async function getOrganizationDetailData(
  supabase: SupabaseClient,
  organizationId: string
): Promise<OrganizationDetailData> {
  const { data, error } = await supabase
    .from('organizations')
    .select(organizationDetailSelect)
    .eq('id', organizationId)
    .maybeSingle();

  if (error || !data) {
    return {
      source: 'empty',
      row: null,
      relatedContacts: []
    };
  }

  return normalizeOrganizationContactRow(data as OrganizationQueryRow);
}
