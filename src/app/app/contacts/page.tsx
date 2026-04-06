import Link from 'next/link';
import { addContactAction, addOrganizationAction } from '@/app/app/actions';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime, getContactsPageData } from '@/lib/data/contacts';
import {
  getSearchParam,
  normalizeBooleanFilter,
  normalizeOptionalFilter
} from '@/lib/data/filters';

type ContactsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getMessageParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const created = getMessageParam(resolvedSearchParams.created);
  const error = getMessageParam(resolvedSearchParams.error);
  const filters = {
    query: normalizeOptionalFilter(getSearchParam(resolvedSearchParams.q)),
    status: normalizeOptionalFilter(getSearchParam(resolvedSearchParams.status)),
    organizationType: normalizeOptionalFilter(getSearchParam(resolvedSearchParams.organization_type)),
    hasEmail: normalizeBooleanFilter(getSearchParam(resolvedSearchParams.has_email)),
    hasLinkedin: normalizeBooleanFilter(getSearchParam(resolvedSearchParams.has_linkedin))
  };
  const supabase = await createClient();
  const data = await getContactsPageData(supabase, filters);

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <div className="badge">Contacts</div>
          <h1 style={{ margin: '12px 0 8px', fontSize: 36 }}>People and relationship memory</h1>
          <div className="subtle">
            Real contact rows from Supabase, plus a simple way to add a person or organization without leaving the app.
          </div>
        </div>
        <div className="badge">Source: {data.source === 'supabase' ? 'Supabase' : 'Empty / fallback'}</div>
      </div>

      {created ? (
        <div className="successBanner">
          {created === 'organization' ? 'Organization added.' : 'Person added.'}
        </div>
      ) : null}
      {error ? <div className="errorBanner">{error}</div> : null}

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <section className="panel"><div className="kpiTitle">Contacts</div><div className="kpiValue">{data.filteredContacts}</div></section>
        <section className="panel"><div className="kpiTitle">Linked orgs</div><div className="kpiValue">{data.linkedOrganizations}</div></section>
        <section className="panel"><div className="kpiTitle">With email</div><div className="kpiValue">{data.withEmail}</div></section>
        <section className="panel"><div className="kpiTitle">Added in 30d</div><div className="kpiValue">{data.recentlyAdded}</div></section>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <section className="panel">
          <h2 className="sectionTitle">Add person</h2>
          <form action={addContactAction} className="stack">
            <div className="formGrid formGrid2">
              <label className="field">
                <span>First name</span>
                <input name="first_name" required />
              </label>
              <label className="field">
                <span>Last name</span>
                <input name="last_name" required />
              </label>
            </div>

            <div className="formGrid formGrid2">
              <label className="field">
                <span>Title</span>
                <input name="job_title" />
              </label>
              <label className="field">
                <span>Email</span>
                <input name="email" type="email" />
              </label>
            </div>

            <label className="field">
              <span>Organization</span>
              <select name="organization_id" defaultValue="">
                <option value="">No organization yet</option>
                {data.organizationOptions.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>LinkedIn URL</span>
              <input name="linkedin_url" type="url" />
            </label>

            <label className="field">
              <span>Notes</span>
              <textarea name="notes" rows={4} />
            </label>

            <div>
              <button type="submit" className="primaryButton">Add person</button>
            </div>
          </form>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">Add organization</h2>
          <form action={addOrganizationAction} className="stack">
            <label className="field">
              <span>Name</span>
              <input name="name" required />
            </label>

            <div className="formGrid formGrid2">
              <label className="field">
                <span>Type</span>
                <input name="organization_type" placeholder="Firm" />
              </label>
              <label className="field">
                <span>HQ</span>
                <input name="headquarters" />
              </label>
            </div>

            <label className="field">
              <span>Notes</span>
              <textarea name="notes" rows={6} />
            </label>

            <div>
              <button type="submit" className="primaryButton">Add organization</button>
            </div>
          </form>
        </section>
      </div>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2 className="sectionTitle">Recent contacts</h2>
            <div className="subtle">
              Showing {data.filteredContacts} of {data.totalContacts} contacts
              {data.activeFilterCount ? ` with ${data.activeFilterCount} active filter${data.activeFilterCount === 1 ? '' : 's'}` : ''}.
            </div>
          </div>
          {data.activeFilterCount ? (
            <Link href="/app/contacts" className="secondaryButton">Clear filters</Link>
          ) : null}
        </div>

        <form className="filterPanel">
          <div className="filterGrid filterGrid4">
            <label className="field">
              <span>Search</span>
              <input
                name="q"
                defaultValue={filters.query ?? ''}
                placeholder="Person, org, title, note"
              />
            </label>

            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue={filters.status ?? ''}>
                <option value="">All statuses</option>
                {data.filterOptions.statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Organization type</span>
              <select name="organization_type" defaultValue={filters.organizationType ?? ''}>
                <option value="">All types</option>
                {data.filterOptions.organizationTypes.map((organizationType) => (
                  <option key={organizationType} value={organizationType}>{organizationType}</option>
                ))}
              </select>
            </label>

            <div className="filterToggleRow">
              <label className="checkboxField">
                <input type="checkbox" name="has_email" value="1" defaultChecked={filters.hasEmail} />
                <span>Has email</span>
              </label>
              <label className="checkboxField">
                <input type="checkbox" name="has_linkedin" value="1" defaultChecked={filters.hasLinkedin} />
                <span>Has LinkedIn</span>
              </label>
            </div>
          </div>

          <div className="buttonRow">
            <button type="submit" className="primaryButton">Apply filters</button>
            {data.activeFilterCount ? (
              <Link href="/app/contacts" className="secondaryButton">Reset</Link>
            ) : null}
          </div>
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
              {data.rows.length ? data.rows.map((row) => {
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
                      {row.primary_organization?.name ?? '—'}
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
                  <td colSpan={7} className="subtle">No contact rows available yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
