import Link from 'next/link';
import { addContactAction, addOrganizationAction } from '@/app/app/actions';
import { EmptyState, FilterSummary, MetricCard, PageHeader } from '@/components/crm-ui';
import { createClient } from '@/lib/supabase/server';
import {
  formatDateTime,
  getContactDisplayName,
  getContactsPageData,
  matchesContactQuery
} from '@/lib/data/contacts';
import { formatReviewFlags } from '@/lib/data/record-quality';

type ContactsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const created = getParam(resolvedSearchParams.created);
  const error = getParam(resolvedSearchParams.error);
  const reviewMode = getParam(resolvedSearchParams.view) === 'review';
  const query = getParam(resolvedSearchParams.q).trim();
  const status = getParam(resolvedSearchParams.status).trim();
  const organizationId = getParam(resolvedSearchParams.organization).trim();

  const supabase = await createClient();
  const data = await getContactsPageData(supabase);

  const allRows = reviewMode ? data.reviewRows : data.rows;
  const filteredRows = allRows.filter((row) => {
    if (status && (row.status ?? '') !== status) return false;

    if (
      organizationId &&
      row.primary_organization?.id !== organizationId &&
      !row.organizations.some((organizationLink) => organizationLink.organization?.id === organizationId)
    ) {
      return false;
    }

    if (!matchesContactQuery(row, query)) return false;
    return true;
  });

  const statusOptions = Array.from(
    new Set(allRows.map((row) => row.status).filter((value): value is string => Boolean(value)))
  ).sort((a, b) => a.localeCompare(b));

  const activeFilterCount = [query, status, organizationId].filter(Boolean).length;

  return (
    <div className="pageStack">
      <PageHeader
        eyebrow="Contacts"
        title="People records and relationship memory"
        description={
          <>
            The default roster favors usable people records tied to credible organizations. Search, status, and organization
            filters make the list practical to work, while review mode isolates synthetic or low-confidence imports.
          </>
        }
        meta={
          <>
            <div className="sourceBadge">Source: {data.source === 'supabase' ? 'Supabase' : 'Empty / fallback'}</div>
            <div className="badge">{reviewMode ? 'Review mode' : 'Working contacts'}</div>
          </>
        }
        actions={[
          {
            href: reviewMode ? '/app/contacts' : '/app/contacts?view=review',
            label: reviewMode ? 'Hide review queue' : `Review queue (${data.reviewContacts})`,
            variant: 'secondary'
          }
        ]}
      />

      {created ? (
        <div className="successBanner">
          {created === 'organization' ? 'Organization added to the CRM.' : 'Person added to the CRM.'}
        </div>
      ) : null}
      {error ? <div className="errorBanner">{error}</div> : null}

      <div className="grid grid-4">
        <MetricCard label="Verified contacts" value={data.verifiedContacts} note="Default CRM roster" tone="accent" />
        <MetricCard label="Review queue" value={data.reviewContacts} note="Fake, redacted, or test-marker contacts" tone="review" />
        <MetricCard label="Linked orgs" value={data.linkedOrganizations} note="Verified contacts with organization context" />
        <MetricCard label="With email" value={data.withEmail} note="Reachable contacts for active outreach" tone="success" />
      </div>

      <div className="grid grid-2">
        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Add person</h2>
              <div className="subtle">Organization picker only shows verified organizations.</div>
            </div>
            <div className="badge">Recent adds: {data.recentlyAdded}</div>
          </div>
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
                <input name="job_title" placeholder="Partner, Principal, EA, ..." />
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
              <input name="linkedin_url" type="url" placeholder="https://www.linkedin.com/in/..." />
            </label>

            <label className="field">
              <span>Notes</span>
              <textarea name="notes" rows={4} placeholder="Context, relationship notes, recent conversations..." />
            </label>

            <div>
              <button type="submit" className="primaryButton">Add person</button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Add organization</h2>
              <div className="subtle">New organizations go straight into the clean operating path.</div>
            </div>
          </div>
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
                <input name="headquarters" placeholder="New York, NY" />
              </label>
            </div>

            <label className="field">
              <span>Notes</span>
              <textarea name="notes" rows={6} placeholder="Firm notes, thesis context, or sourcing information..." />
            </label>

            <div>
              <button type="submit" className="primaryButton">Add organization</button>
            </div>
          </form>
        </section>
      </div>

      <section className={`panel${reviewMode ? ' reviewPanel' : ''}`}>
        <div className="panelHeader">
          <div className="panelTitleGroup">
            <h2 className="sectionTitle">{reviewMode ? 'Contacts review queue' : 'Recent verified contacts'}</h2>
            <div className="subtle">
              {reviewMode
                ? 'Suppressed from the working CRM until the source is cleaned up or the record is edited.'
                : 'Searchable list of usable people records ready for follow-up.'}
            </div>
          </div>
          <div className={`statusBadge ${reviewMode ? 'statusBadge-amber' : 'statusBadge-green'}`}>
            {filteredRows.length} {reviewMode ? 'flagged rows' : 'visible rows'}
          </div>
        </div>

        <div className="toolbar">
          <form className="toolbarForm" method="get">
            {reviewMode ? <input type="hidden" name="view" value="review" /> : null}

            <label className="fieldGroup fieldGroup-search">
              <span className="fieldLabel">Search</span>
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Name, title, email, org, notes, or LinkedIn"
              />
            </label>

            <label className="fieldGroup">
              <span className="fieldLabel">Status</span>
              <select name="status" defaultValue={status}>
                <option value="">All statuses</option>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="fieldGroup">
              <span className="fieldLabel">Organization</span>
              <select name="organization" defaultValue={organizationId}>
                <option value="">All organizations</option>
                {data.organizationOptions.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="toolbarActions">
              <button type="submit" className="primaryButton">Apply filters</button>
              <Link href={reviewMode ? '/app/contacts?view=review' : '/app/contacts'} className="secondaryButton">
                Reset
              </Link>
            </div>
          </form>

          <div className="toolbarSummary">
            <FilterSummary
              heading={activeFilterCount ? 'Filtered contacts' : reviewMode ? 'Review queue' : 'Working roster'}
              detail={
                activeFilterCount
                  ? `${filteredRows.length} matches across ${allRows.length} rows in this view.`
                  : `${allRows.length} rows available in this view.`
              }
            />
            {!reviewMode ? <div className="badge">Added in 30d: {data.recentlyAdded}</div> : <div className="badge">Low-confidence contact records</div>}
          </div>
        </div>

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
                <th>{reviewMode ? 'Flags' : 'Notes'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? (
                filteredRows.map((row) => {
                  const organizations = row.organizations
                    .map((organizationLink) => organizationLink.organization?.name)
                    .filter(Boolean)
                    .slice(0, 3)
                    .join(' · ');

                  return (
                    <tr key={row.id}>
                      <td>
                        <Link href={`/app/contacts/${row.id}`} className="tableTitle">
                          {getContactDisplayName(row)}
                        </Link>
                        <div className="tableSubtle">
                          {row.linkedin_url ? 'LinkedIn on file' : 'No LinkedIn yet'}
                        </div>
                      </td>
                      <td>
                        <div>{row.primary_organization?.name ?? '—'}</div>
                        <div className="tableSubtle">{organizations || 'No related org links yet'}</div>
                      </td>
                      <td>{row.job_title ?? '—'}</td>
                      <td>
                        <div>{row.email ?? row.phone ?? '—'}</div>
                        <div className="tableSubtle">{row.preferred_channel ?? 'No preferred channel'}</div>
                      </td>
                      <td>{row.status ?? '—'}</td>
                      <td>{formatDateTime(row.created_at)}</td>
                      <td className="tableNote">
                        {reviewMode
                          ? formatReviewFlags(row.review_flags).join(' · ') || 'Needs review'
                          : row.notes ?? '—'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No contacts match the current filters"
                      detail={
                        activeFilterCount
                          ? 'Try broadening the search, clearing one of the filters, or switching review mode.'
                          : 'No contacts are available in this view yet.'
                      }
                      action={
                        <Link href={reviewMode ? '/app/contacts?view=review' : '/app/contacts'} className="secondaryButton">
                          Clear filters
                        </Link>
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
