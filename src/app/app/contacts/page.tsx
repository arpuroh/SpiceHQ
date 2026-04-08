import Link from 'next/link';
import { ContactCreateForm } from '@/components/forms/contact-create-form';
import { OrganizationCreateForm } from '@/components/forms/organization-create-form';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime, getContactsPageData, matchesContactQuery } from '@/lib/data/contacts';

type ContactsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getMessageParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function getParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const error = getMessageParam(resolvedSearchParams.error);
  const query = getParam(resolvedSearchParams.q).trim();
  const organizationFilter = getParam(resolvedSearchParams.organization).trim();
  const supabase = await createClient();
  const data = await getContactsPageData(supabase);
  const filteredRows = data.rows.filter((row) => {
    if (organizationFilter) {
      const matchesOrganization = row.primary_organization?.id === organizationFilter || row.organizations.some((organizationLink) => organizationLink.organization?.id === organizationFilter);
      if (!matchesOrganization) return false;
    }
    if (query && !matchesContactQuery(row, query)) return false;
    return true;
  });

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <div className="badge">Contacts</div>
          <h1 style={{ margin: '12px 0 8px', fontSize: 36 }}>People and relationship memory</h1>
          <div className="subtle">
            Real contact rows from Supabase, with faster create flows and direct drill-in editing for both people and organizations.
          </div>
        </div>
        <div className="badge">Source: {data.source === 'supabase' ? 'Supabase' : 'Empty / fallback'}</div>
      </div>

      {error ? <div className="errorBanner">{error}</div> : null}

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <section className="panel"><div className="kpiTitle">Source contacts</div><div className="kpiValue">{data.totalContacts}</div><div className="metricNote">{data.visibleContacts} visible · {data.hiddenContacts} in review</div></section>
        <section className="panel"><div className="kpiTitle">Linked orgs</div><div className="kpiValue">{data.linkedOrganizations}</div></section>
        <section className="panel"><div className="kpiTitle">With email</div><div className="kpiValue">{data.withEmail}</div></section>
        <section className="panel"><div className="kpiTitle">Added in 30d</div><div className="kpiValue">{data.recentlyAdded}</div></section>
      </div>

      {data.hiddenContacts > 0 ? (
        <div className="successBanner" style={{ marginBottom: 24 }}>
          {data.hiddenContacts} contacts are currently suppressed from the working view. They still exist in the source layer and can be inspected in <Link href="/app/review" className="inlineLink">review</Link>.
        </div>
      ) : null}

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <section className="panel">
          <h2 className="sectionTitle">Add person</h2>
          <div className="subtle" style={{ marginBottom: 16 }}>
            Capture the essentials first, then land directly on the detail page to keep editing.
          </div>
          <ContactCreateForm organizationOptions={data.organizationOptions} />
        </section>

        <section className="panel">
          <h2 className="sectionTitle">Add organization</h2>
          <div className="subtle" style={{ marginBottom: 16 }}>
            Create the firm record with enough context to link contacts immediately.
          </div>
          <OrganizationCreateForm />
        </section>
      </div>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panelHeader">
          <div>
            <h2 className="sectionTitle" style={{ marginBottom: 6 }}>Recent organizations</h2>
            <div className="subtle">Shortcut into organization records without leaving the Contacts workspace.</div>
          </div>
        </div>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Type</th>
                <th>HQ</th>
                <th>Channel</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrganizations.length ? data.recentOrganizations.map((organization) => (
                <tr key={organization.id}>
                  <td>
                    <Link href={`/app/organizations/${organization.id}`} style={{ fontWeight: 700 }}>
                      {organization.name}
                    </Link>
                  </td>
                  <td>{organization.organization_type ?? '—'}</td>
                  <td>{organization.headquarters ?? '—'}</td>
                  <td>{organization.preferred_channel ?? '—'}</td>
                  <td>{formatDateTime(organization.created_at ?? null)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="subtle">No organization rows available yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2 className="sectionTitle" style={{ marginBottom: 6 }}>Recent contacts</h2>
            <div className="subtle">Search by person, role, org, or contact method.</div>
          </div>
        </div>
        <form method="get" action="/app/contacts" className="filterBar" style={{ marginBottom: 16 }}>
          <input type="text" name="q" placeholder="Search person, org, title, email…" defaultValue={query} className="filterInput" />
          <select name="organization" defaultValue={organizationFilter} className="filterSelect">
            <option value="">All organizations</option>
            {data.organizationOptions.map((organization) => (
              <option key={organization.id} value={organization.id}>{organization.name}</option>
            ))}
          </select>
          <button type="submit" className="secondaryButton">Filter</button>
        </form>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Organization</th>
                <th>Title</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Created</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? filteredRows.map((row) => {
                const organizations = row.organizations
                  .map((organizationLink) => organizationLink.organization?.name)
                  .filter(Boolean)
                  .slice(0, 3)
                  .join(' · ');

                return (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/app/contacts/${row.id}`} style={{ fontWeight: 700 }}>
                        {row.full_name ?? `${row.first_name} ${row.last_name ?? ''}`.trim()}
                      </Link>
                      <div className="tableSubtle">{row.linkedin_url ? 'LinkedIn on file' : 'No LinkedIn yet'}</div>
                    </td>
                    <td>
                      {row.primary_organization ? (
                        <Link href={`/app/organizations/${row.primary_organization.id}`} style={{ fontWeight: 600 }}>
                          {row.primary_organization.name}
                        </Link>
                      ) : '—'}
                      <div className="tableSubtle">{organizations || 'No related org links yet'}</div>
                    </td>
                    <td>{row.job_title ?? '—'}</td>
                    <td>
                      {row.email ?? row.phone ?? '—'}
                      <div className="tableSubtle">{row.preferred_channel ?? 'No preferred channel'}</div>
                    </td>
                    <td>{row.status ?? '—'}</td>
                    <td>{formatDateTime(row.created_at)}</td>
                    <td>{row.notes ?? '—'}</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="subtle">{query || organizationFilter ? 'No contacts match the current filters.' : 'No contact rows available yet.'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
