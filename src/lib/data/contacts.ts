import type { SupabaseClient } from '@supabase/supabase-js';
import {
  curateContactLikeRecord,
  curateRecords,
  type CuratedReason
} from '@/lib/data/curation';

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
  visibleContacts: number;
  hiddenContacts: number;
  linkedOrganizations: number;
  withEmail: number;
  recentlyAdded: number;
  rows: ContactRow[];
  hiddenRows: Array<{
    row: ContactRow;
    reasons: CuratedReason[];
  }>;
  organizationOptions: ContactOrganization[];
}

export interface ContactDetailData {
  source: 'supabase' | 'empty';
  row: ContactRow | null;
  curation: {
    hidden: boolean;
    score: number;
    reasons: CuratedReason[];
  } | null;
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

export async function getContactsPageData(supabase: SupabaseClient): Promise<ContactPageData> {
  const [{ data: contactsData, error: contactsError, count }, { data: organizationsData, error: organizationsError }] =
    await Promise.all([
      supabase
        .from('contacts')
        .select(contactSelect, { count: 'exact' })
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(200),
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
      visibleContacts: 0,
      hiddenContacts: 0,
      linkedOrganizations: 0,
      withEmail: 0,
      recentlyAdded: 0,
      rows: [],
      hiddenRows: [],
      organizationOptions: []
    };
  }

  const allRows = (contactsData ?? []).map((row) => normalizeContactRow(row as ContactQueryRow));
  const curated = curateRecords(allRows, (row) => {
    const evaluation = curateContactLikeRecord({
      identityValues: [row.full_name, row.first_name, row.last_name, row.email],
      markerValues: [
        row.full_name,
        row.first_name,
        row.last_name,
        row.job_title,
        row.email,
        row.linkedin_url,
        row.status,
        row.notes,
        row.primary_organization?.name
      ],
      hasDirectContactMethod: Boolean(row.email || row.phone || row.linkedin_url),
      hasProfessionalContext: Boolean(row.job_title),
      hasOrganizationLink: Boolean(row.primary_organization || row.organizations.length),
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
    hiddenRows: curated.hidden.map((item) => ({
      row: item.row,
      reasons: item.reasons
    })),
    organizationOptions: (organizationsData ?? []) as ContactOrganization[]
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
      curation: null,
      organizationOptions: []
    };
  }

  const row = normalizeContactRow(contactData as ContactQueryRow);
  const curation = curateContactLikeRecord({
    identityValues: [row.full_name, row.first_name, row.last_name, row.email],
    markerValues: [
      row.full_name,
      row.first_name,
      row.last_name,
      row.job_title,
      row.email,
      row.linkedin_url,
      row.status,
      row.notes,
      row.primary_organization?.name
    ],
    hasDirectContactMethod: Boolean(row.email || row.phone || row.linkedin_url),
    hasProfessionalContext: Boolean(row.job_title),
    hasOrganizationLink: Boolean(row.primary_organization || row.organizations.length),
    status: row.status,
    hasNotes: Boolean(row.notes?.trim())
  });

  return {
    source: 'supabase',
    row,
    curation,
    organizationOptions: (organizationsData ?? []) as ContactOrganization[]
  };
}
