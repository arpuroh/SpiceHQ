import Link from 'next/link';
import { EmptyState, FilterSummary, MetricCard, PageHeader } from '@/components/crm-ui';
import { createClient } from '@/lib/supabase/server';
import { formatUsd, getFundraisingPageData, matchesFundraisingQuery } from '@/lib/data/fundraising';

type FundraisingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function FundraisingPage({ searchParams }: FundraisingPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = getParam(resolvedSearchParams.q).trim();
  const organizationFilter = getParam(resolvedSearchParams.organization).trim();
  const stageFilter = getParam(resolvedSearchParams.stage).trim();
  const statusFilter = getParam(resolvedSearchParams.status).trim();
  const supabase = await createClient();
  const data = await getFundraisingPageData(supabase);
  const filteredRows = data.rows.filter((row) => {
    if (organizationFilter && (row.organization?.id ?? '') !== organizationFilter) return false;
    if (stageFilter && row.stage !== stageFilter) return false;
    if (statusFilter && row.status !== statusFilter) return false;
    if (query && !matchesFundraisingQuery(row, query)) return false;
    return true;
  });
  const organizationOptions = Array.from(
    new Map(data.rows.filter((row) => row.organization).map((row) => [row.organization!.id, row.organization!])).values()
  );
  const stageOptions = Array.from(new Set(data.rows.map((row) => row.stage).filter(Boolean))).sort();
  const statusOptions = Array.from(new Set(data.rows.map((row) => row.status).filter(Boolean))).sort();
  const activeFilterCount = [query, organizationFilter, stageFilter, statusFilter].filter(Boolean).length;

  return (
    <div className="pageStack">
      <PageHeader
        eyebrow="Fundraising"
        title="Investor pipeline and capital tracking"
        description={
          <>
            Curated accounts emphasize real organizations, live relationship context, and actual capital signal.
            Placeholder source rows stay out of the working view.
          </>
        }
        meta={
          <>
            <div className="sourceBadge">Source: {data.source === 'supabase' ? 'Supabase' : 'Empty / fallback'}</div>
            <div className="badge">{data.totalAccounts} imported rows</div>
          </>
        }
        actions={[
          { href: '/app/organizations', label: 'Open organizations', variant: 'secondary' },
          { href: '/app/review', label: `Review hidden rows (${data.hiddenAccounts})`, variant: 'secondary' }
        ]}
      />

      <div className="grid grid-4">
        <MetricCard label="Source accounts" value={data.totalAccounts} note={`${data.visibleAccounts} visible · ${data.hiddenAccounts} in review`} tone="accent" />
        <MetricCard label="Target" value={formatUsd(data.totalTarget)} note="Combined target commitments" />
        <MetricCard label="Soft circled" value={formatUsd(data.totalSoftCircled)} note="Current soft commitments" tone="success" />
        <MetricCard label="Committed" value={formatUsd(data.totalCommitted)} note="Hard committed capital" />
      </div>

      {!activeFilterCount ? (
        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Organization fundraising lanes</h2>
              <div className="subtle">Use the organization as the operating hub, then jump into pipeline, contacts, and relationship history.</div>
            </div>
          </div>

          <div className="activityList">
            {filteredRows.slice(0, 8).map((row) => (
              <div key={row.id} className="activityItem">
                <div className="splitRow">
                  <Link href={row.organization ? `/app/organizations/${row.organization.id}` : '/app/fundraising'} className="tableTitle">
                    {row.organization?.name ?? 'Unknown organization'}
                  </Link>
                  <span className="badge">{row.stage}</span>
                </div>
                <div className="tableSubtle">
                  {[row.organization?.organization_type, row.organization?.headquarters, row.relationship_temperature].filter(Boolean).join(' · ') || 'No extra context yet'}
                </div>
                <div className="contextLinksRow" style={{ marginTop: 8 }}>
                  {row.organization ? <Link href={`/app/organizations/${row.organization.id}`} className="inlineLink">Organization</Link> : null}
                  {row.organization ? <span>·</span> : null}
                  {row.organization ? <Link href={`/app/contacts?organization=${row.organization.id}`} className="inlineLink">Contacts</Link> : null}
                  {row.organization ? <span>·</span> : null}
                  {row.organization ? <Link href={`/app/interactions?organization=${row.organization.id}`} className="inlineLink">Interactions</Link> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {data.hiddenAccounts > 0 ? (
        <div className="successBanner">
          {data.hiddenAccounts} fundraising rows are currently suppressed from the working view. They still exist in the source layer and can be inspected in <Link href="/app/review" className="inlineLink">review</Link>.
        </div>
      ) : null}

      <section className="panel">
        <div className="panelHeader">
          <div className="panelTitleGroup">
            <h2 className="sectionTitle">Curated accounts</h2>
            <div className="subtle">Sorted toward accounts with real organizations, financial signal, and relationship context.</div>
          </div>
          <div className="statusBadge statusBadge-green">{filteredRows.length} visible rows</div>
        </div>

        <div className="toolbar">
          <form method="get" action="/app/fundraising" className="toolbarForm">
            <label className="fieldGroup fieldGroup-search">
              <span className="fieldLabel">Search</span>
              <input type="search" name="q" placeholder="Investor, org, stage, notes…" defaultValue={query} />
            </label>

            <label className="fieldGroup">
              <span className="fieldLabel">Organization</span>
              <select name="organization" defaultValue={organizationFilter}>
                <option value="">All organizations</option>
                {organizationOptions.map((organization) => (
                  <option key={organization.id} value={organization.id}>{organization.name}</option>
                ))}
              </select>
            </label>

            <label className="fieldGroup">
              <span className="fieldLabel">Stage</span>
              <select name="stage" defaultValue={stageFilter}>
                <option value="">All stages</option>
                {stageOptions.map((stage) => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </label>

            <label className="fieldGroup">
              <span className="fieldLabel">Status</span>
              <select name="status" defaultValue={statusFilter}>
                <option value="">All statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>

            <div className="toolbarActions">
              <button type="submit" className="primaryButton">Apply filters</button>
              <Link href="/app/fundraising" className="secondaryButton">Reset</Link>
            </div>
          </form>

          <div className="toolbarSummary">
            <FilterSummary
              heading={activeFilterCount ? 'Filtered fundraising view' : 'Working fundraising view'}
              detail={activeFilterCount ? `${filteredRows.length} matches across ${data.rows.length} visible rows.` : `${data.rows.length} curated accounts in the working view.`}
            />
          </div>
        </div>

        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Investor</th>
                <th>Stage</th>
                <th>Type</th>
                <th>HQ</th>
                <th>Probability</th>
                <th>Target</th>
                <th>Soft circled</th>
                <th>Committed</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.organization ? (
                      <Link href={`/app/organizations/${row.organization.id}`} className="tableTitle">{row.organization.name}</Link>
                    ) : (
                      <strong>Unknown organization</strong>
                    )}
                    <div className="tableSubtle">{row.organization?.tags?.slice(0, 3).join(' · ') || 'No tags yet'}</div>
                    {row.organization ? (
                      <div className="contextLinksRow" style={{ marginTop: 8 }}>
                        <Link href={`/app/organizations/${row.organization.id}`} className="inlineLink">Organization</Link>
                        <span>·</span>
                        <Link href={`/app/contacts?organization=${row.organization.id}`} className="inlineLink">Contacts</Link>
                        <span>·</span>
                        <Link href={`/app/interactions?organization=${row.organization.id}`} className="inlineLink">Interactions</Link>
                      </div>
                    ) : null}
                  </td>
                  <td>{row.stage}</td>
                  <td>{row.organization?.organization_type ?? '—'}</td>
                  <td>{row.organization?.headquarters ?? '—'}</td>
                  <td>{row.probability_pct ?? '—'}{row.probability_pct !== null ? '%' : ''}</td>
                  <td>{formatUsd(row.target_commitment)}</td>
                  <td>{formatUsd(row.soft_circled_amount)}</td>
                  <td>{formatUsd(row.committed_amount)}</td>
                  <td>{row.memo ?? '—'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title="No fundraising rows match the current filters"
                      detail={query || organizationFilter ? 'Try broadening the search or clearing filters.' : 'No fundraising rows available yet.'}
                      action={<Link href="/app/fundraising" className="secondaryButton">Clear filters</Link>}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {data.hiddenRows.length ? (
        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Suppressed fundraising rows</h2>
              <div className="subtle">These rows remain accessible for cleanup and source-data triage.</div>
            </div>
            <div className="badge">{data.hiddenRows.length} suspect rows</div>
          </div>

          <div className="activityList">
            {data.hiddenRows.slice(0, 12).map(({ row, reasons }) => (
              <div key={row.id} className="activityItem">
                <strong>{row.organization?.name ?? 'Unknown organization'}</strong>
                <div className="tableSubtle">
                  {row.stage} · {formatUsd(row.target_commitment)} target · {row.relationship_temperature ?? 'No relationship signal'}
                </div>
                <div className="pillRow">
                  {reasons.map((reason) => (
                    <span key={`${row.id}-${reason.code}`} className="reasonPill">{reason.label}</span>
                  ))}
                </div>
                <div className="reasonList">
                  {reasons.map((reason) => (
                    <div key={`${row.id}-${reason.code}-detail`} className="tableSubtle">{reason.detail}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
