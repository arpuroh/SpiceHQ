import Link from 'next/link';
import { addOrganizationAction } from '@/app/app/actions';
import { EmptyState, FilterSummary, MetricCard, PageHeader } from '@/components/crm-ui';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/data/contacts';
import {
  getOrganizationsPageData,
  matchesOrganizationQuery
} from '@/lib/data/organizations';
import { formatReviewFlags } from '@/lib/data/record-quality';

type OrganizationsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function OrganizationsPage({ searchParams }: OrganizationsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const created = getParam(resolvedSearchParams.created);
  const error = getParam(resolvedSearchParams.error);
  const reviewMode = getParam(resolvedSearchParams.view) === 'review';
  const query = getParam(resolvedSearchParams.q).trim();
  const orgType = getParam(resolvedSearchParams.type).trim();

  const supabase = await createClient();
  const data = await getOrganizationsPageData(supabase);

  const allRows = reviewMode ? data.reviewRows : data.rows;
  const filteredRows = allRows.filter((row) => {
    if (orgType && (row.organization_type ?? '') !== orgType) return false;
    if (!matchesOrganizationQuery(row, query)) return false;
    return true;
  });

  const typeOptions = Array.from(
    new Set(allRows.map((row) => row.organization_type).filter((value): value is string => Boolean(value)))
  ).sort((a, b) => a.localeCompare(b));

  const activeFilterCount = [query, orgType].filter(Boolean).length;

  return (
    <div className="pageStack">
      <PageHeader
        eyebrow="Organizations"
        title="Investor directory and firm roster"
        description={
          <>
            The verified directory includes only organizations that pass quality checks.
            Firms, family offices, angels, and other counterparties are all tracked here.
          </>
        }
        meta={
          <>
            <div className="sourceBadge">Source: {data.source === 'supabase' ? 'Supabase' : 'Empty / fallback'}</div>
            <div className="badge">{reviewMode ? 'Review mode' : 'Working directory'}</div>
          </>
        }
        actions={[
          {
            href: reviewMode ? '/app/organizations' : '/app/organizations?view=review',
            label: reviewMode ? 'Hide review queue' : `Review queue (${data.reviewOrganizations})`,
            variant: 'secondary'
          }
        ]}
      />

      {created === 'organization' ? (
        <div className="successBanner">Organization added to the CRM.</div>
      ) : null}
      {error ? <div className="errorBanner">{error}</div> : null}

      <div className="grid grid-4">
        <MetricCard label="Verified organizations" value={data.verifiedOrganizations} note="In the working directory" tone="accent" />
        <MetricCard label="Review queue" value={data.reviewOrganizations} note="Flagged or low-confidence records" tone="review" />
        <MetricCard label="With contacts" value={data.withContacts} note="Verified orgs linked to people" tone="success" />
        <MetricCard label="With fundraising" value={data.withFundraising} note="Orgs tied to pipeline accounts" />
      </div>

      <section className="panel">
        <div className="panelHeader">
          <div className="panelTitleGroup">
            <h2 className="sectionTitle">Add organization</h2>
            <div className="subtle">New organizations go straight into the verified directory.</div>
          </div>
        </div>
        <form action={addOrganizationAction} className="stack">
          <div className="formGrid formGrid2">
            <label className="field">
              <span>Name</span>
              <input name="name" required />
            </label>
            <label className="field">
              <span>Type</span>
              <input name="organization_type" placeholder="Venture Capital, Family Office, Angel, ..." />
            </label>
          </div>

          <div className="formGrid formGrid2">
            <label className="field">
              <span>Headquarters</span>
              <input name="headquarters" placeholder="New York, NY" />
            </label>
            <label className="field">
              <span>Website</span>
              <input name="website" type="url" placeholder="https://..." />
            </label>
          </div>

          <label className="field">
            <span>Notes</span>
            <textarea name="notes" rows={3} placeholder="Firm thesis, sourcing info, relationship context..." />
          </label>

          <div>
            <button type="submit" className="primaryButton">Add organization</button>
          </div>
        </form>
      </section>

      <section className={`panel${reviewMode ? ' reviewPanel' : ''}`}>
        <div className="panelHeader">
          <div className="panelTitleGroup">
            <h2 className="sectionTitle">{reviewMode ? 'Organizations review queue' : 'Organization directory'}</h2>
            <div className="subtle">
              {reviewMode
                ? 'Records held back from the working directory due to quality flags.'
                : 'Searchable list of verified organizations.'}
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
                placeholder="Name, type, location, notes, or website"
              />
            </label>

            <label className="fieldGroup">
              <span className="fieldLabel">Type</span>
              <select name="type" defaultValue={orgType}>
                <option value="">All types</option>
                {typeOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <div className="toolbarActions">
              <button type="submit" className="primaryButton">Apply filters</button>
              <Link href={reviewMode ? '/app/organizations?view=review' : '/app/organizations'} className="secondaryButton">
                Reset
              </Link>
            </div>
          </form>

          <div className="toolbarSummary">
            <FilterSummary
              heading={activeFilterCount ? 'Filtered organizations' : reviewMode ? 'Review queue' : 'Working directory'}
              detail={
                activeFilterCount
                  ? `${filteredRows.length} matches across ${allRows.length} rows.`
                  : `${allRows.length} organizations in this view.`
              }
            />
          </div>
        </div>

        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Type</th>
                <th>Headquarters</th>
                <th>Contacts</th>
                <th>Pipeline</th>
                <th>{reviewMode ? 'Flags' : 'Notes'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/app/organizations/${row.id}`} className="tableTitle">
                        {row.name}
                      </Link>
                      <div className="tableSubtle">
                        {row.website ? new URL(row.website).hostname.replace('www.', '') : row.tags?.slice(0, 3).join(' · ') || 'No website'}
                      </div>
                    </td>
                    <td>{row.organization_type ?? '—'}</td>
                    <td>{row.headquarters ?? '—'}</td>
                    <td>
                      {row.contact_count > 0 ? (
                        <span className="badge">{row.contact_count}</span>
                      ) : (
                        <span className="tableSubtle">—</span>
                      )}
                    </td>
                    <td>
                      {row.fundraising_count > 0 ? (
                        <span className="badge">{row.fundraising_count}</span>
                      ) : (
                        <span className="tableSubtle">—</span>
                      )}
                    </td>
                    <td className="tableNote">
                      {reviewMode
                        ? formatReviewFlags(row.review_flags).join(' · ') || 'Needs review'
                        : row.notes
                          ? row.notes.length > 80 ? row.notes.slice(0, 80) + '...' : row.notes
                          : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="No organizations match the current filters"
                      detail={
                        activeFilterCount
                          ? 'Try broadening the search or clearing filters.'
                          : 'No organizations in this view yet.'
                      }
                      action={
                        <Link href={reviewMode ? '/app/organizations?view=review' : '/app/organizations'} className="secondaryButton">
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
