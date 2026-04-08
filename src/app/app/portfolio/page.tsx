import Link from 'next/link';
import { addPortfolioCompanyAction } from '@/app/app/actions';
import { PageHeader, MetricCard } from '@/components/crm-ui';
import { createClient } from '@/lib/supabase/server';
import {
  formatDate,
  formatUsd,
  getPortfolioPageData,
  matchesPortfolioQuery
} from '@/lib/data/portfolio';
import { formatReviewFlags } from '@/lib/data/record-quality';

type PortfolioPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function PortfolioPage({ searchParams }: PortfolioPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const created = getParam(resolvedSearchParams.created);
  const error = getParam(resolvedSearchParams.error);
  const reviewMode = getParam(resolvedSearchParams.view) === 'review';
  const query = getParam(resolvedSearchParams.q).trim();
  const stageFilter = getParam(resolvedSearchParams.stage).trim();
  const statusFilter = getParam(resolvedSearchParams.status).trim();
  const organizationFilter = getParam(resolvedSearchParams.organization).trim();

  const supabase = await createClient();
  const data = await getPortfolioPageData(supabase);

  const organizationById = new Map(data.organizationOptions.map((org) => [org.id, org.name]));
  const allRows = reviewMode ? data.reviewRows : data.rows;
  const filteredRows = allRows.filter((row) => {
    if (stageFilter && (row.stage ?? '') !== stageFilter) return false;
    if (statusFilter && (row.status ?? '') !== statusFilter) return false;
    if (organizationFilter && (row.organization_id ?? '') !== organizationFilter) return false;
    if (query && !matchesPortfolioQuery(row, query, row.organization_id ? organizationById.get(row.organization_id) ?? null : null)) return false;
    return true;
  });

  const stageOptions = Array.from(
    new Set(allRows.map((r) => r.stage).filter((v): v is string => Boolean(v)))
  ).sort();

  const statusOptions = Array.from(
    new Set(allRows.map((r) => r.status).filter((v): v is string => Boolean(v)))
  ).sort();

  return (
    <div className="pageStack">
      <PageHeader
        eyebrow="Portfolio"
        title="Portfolio companies and investment tracking"
        description={
          <>
            Active portfolio companies managed by Spice Capital. Track investment details,
            valuations, board seats, and founders across the fund.
          </>
        }
        meta={
          <>
            <div className="sourceBadge">Source: {data.source === 'supabase' ? 'Supabase' : 'Empty / fallback'}</div>
            <div className="badge">{reviewMode ? 'Review mode' : 'Active portfolio'}</div>
          </>
        }
        actions={[
          {
            href: reviewMode ? '/app/portfolio' : '/app/portfolio?view=review',
            label: reviewMode ? 'Hide review queue' : `Review queue (${data.reviewCompanies})`,
            variant: 'secondary'
          }
        ]}
      />

      {created === 'portfolio' && (
        <div className="banner bannerSuccess">Portfolio company added successfully.</div>
      )}
      {error && <div className="banner bannerError">{error}</div>}

      <div className="grid grid-4">
        <MetricCard label="Active companies" value={data.activeCompanies} note={`of ${data.totalCompanies} total`} tone="accent" />
        <MetricCard label="Total invested" value={formatUsd(data.totalInvested)} note="Across active portfolio" tone="success" />
        <MetricCard label="Current value" value={formatUsd(data.totalCurrentValue)} note="Aggregate portfolio valuation" />
        <MetricCard label="Board seats" value={data.withBoardSeat} note="Companies with board representation" />
      </div>

      {!reviewMode && !query && !stageFilter && !statusFilter && !organizationFilter ? (
        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Organization-linked portfolio lanes</h2>
              <div className="subtle">Use organizations as the operating hub for founder, investor, and portfolio context.</div>
            </div>
          </div>
          <div className="activityList">
            {data.rows.filter((row) => row.organization_id).slice(0, 8).map((row) => (
              <div key={row.id} className="activityItem">
                <div className="splitRow">
                  <Link href={`/app/portfolio/${row.id}`} className="tableTitle">{row.company_name}</Link>
                  <span className="badge">{row.stage ?? '—'}</span>
                </div>
                <div className="tableSubtle">
                  {[row.organization_id ? organizationById.get(row.organization_id) ?? null : null, row.sector, row.status].filter(Boolean).join(' · ')}
                </div>
                {row.organization_id ? (
                  <div className="contextLinksRow" style={{ marginTop: 8 }}>
                    <Link href={`/app/organizations/${row.organization_id}`} className="inlineLink">Open organization</Link>
                    <span>·</span>
                    <Link href={`/app/notes?organization=${row.organization_id}`} className="inlineLink">Notes</Link>
                    <span>·</span>
                    <Link href={`/app/tasks?organization=${row.organization_id}`} className="inlineLink">Tasks</Link>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid grid-2">
        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">
                {reviewMode ? 'Review queue' : 'Portfolio companies'} ({filteredRows.length})
              </h2>
            </div>
          </div>

          <form method="get" action="/app/portfolio" className="filterBar">
            <input type="text" name="q" placeholder="Search company, org, sector, or lead…" defaultValue={query} className="filterInput" />
            <select name="organization" defaultValue={organizationFilter} className="filterSelect">
              <option value="">All organizations</option>
              {data.organizationOptions.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
            <select name="stage" defaultValue={stageFilter} className="filterSelect">
              <option value="">All stages</option>
              {stageOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select name="status" defaultValue={statusFilter} className="filterSelect">
              <option value="">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {reviewMode && <input type="hidden" name="view" value="review" />}
            <button type="submit" className="secondaryButton">Filter</button>
          </form>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Invested</th>
                  <th>Valuation</th>
                  <th>Board</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length ? (
                  filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link href={`/app/portfolio/${row.id}`} className="tableTitle">{row.company_name}</Link>
                        <div className="tableSubtle">
                        {[
                          row.organization_id ? organizationById.get(row.organization_id) ?? null : null,
                          row.sector,
                          row.headquarters
                        ].filter(Boolean).join(' · ') || 'No details'}
                        </div>
                        {row.organization_id ? (
                          <div className="contextLinksRow" style={{ marginTop: 8 }}>
                            <Link href={`/app/organizations/${row.organization_id}`} className="inlineLink">Organization</Link>
                            <span>·</span>
                            <Link href={`/app/fundraising?organization=${row.organization_id}`} className="inlineLink">Pipeline</Link>
                            <span>·</span>
                            <Link href={`/app/interactions?organization=${row.organization_id}`} className="inlineLink">Interactions</Link>
                          </div>
                        ) : null}
                        {row.quality === 'review' && (
                          <div className="tableSubtle" style={{ color: 'var(--review)' }}>
                            Review: {formatReviewFlags(row.review_flags).join(', ')}
                          </div>
                        )}
                      </td>
                      <td><span className="badge">{row.stage ?? '—'}</span></td>
                      <td>{row.status ?? '—'}</td>
                      <td>{formatUsd(row.investment_amount)}</td>
                      <td>{formatUsd(row.current_valuation)}</td>
                      <td>{row.board_seat ? 'Yes' : '—'}</td>
                      <td>{formatDate(row.created_at)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7}>
                      <div className="emptyState">
                        <div className="emptyStateTitle">
                          {query || stageFilter || statusFilter || organizationFilter ? 'No matches for current filters' : 'No portfolio companies yet'}
                        </div>
                        <div className="emptyStateBody">
                          {query || stageFilter || statusFilter || organizationFilter
                            ? 'Try broadening your search or clearing filters.'
                            : 'Add your first portfolio company below.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Add portfolio company</h2>
              <div className="subtle">Track a new investment.</div>
            </div>
          </div>
          <form action={addPortfolioCompanyAction} className="formStack">
            <div className="formGroup">
              <label htmlFor="company_name" className="formLabel">Company name *</label>
              <input type="text" id="company_name" name="company_name" required className="formInput" />
            </div>
            <div className="formRow">
              <div className="formGroup">
                <label htmlFor="sector" className="formLabel">Sector</label>
                <input type="text" id="sector" name="sector" placeholder="e.g. Fintech, SaaS" className="formInput" />
              </div>
              <div className="formGroup">
                <label htmlFor="stage" className="formLabel">Stage</label>
                <select id="stage" name="stage" defaultValue="seed" className="formInput">
                  <option value="pre-seed">Pre-seed</option>
                  <option value="seed">Seed</option>
                  <option value="series-a">Series A</option>
                  <option value="series-b">Series B</option>
                  <option value="growth">Growth</option>
                </select>
              </div>
            </div>
            <div className="formRow">
              <div className="formGroup">
                <label htmlFor="investment_amount" className="formLabel">Investment amount ($)</label>
                <input type="number" id="investment_amount" name="investment_amount" step="0.01" className="formInput" />
              </div>
              <div className="formGroup">
                <label htmlFor="valuation_at_entry" className="formLabel">Entry valuation ($)</label>
                <input type="number" id="valuation_at_entry" name="valuation_at_entry" step="0.01" className="formInput" />
              </div>
            </div>
            <div className="formRow">
              <div className="formGroup">
                <label htmlFor="organization_id" className="formLabel">Linked organization</label>
                <select id="organization_id" name="organization_id" className="formInput">
                  <option value="">None</option>
                  {data.organizationOptions.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
              <div className="formGroup">
                <label htmlFor="headquarters" className="formLabel">Headquarters</label>
                <input type="text" id="headquarters" name="headquarters" className="formInput" />
              </div>
            </div>
            <div className="formGroup">
              <label htmlFor="website" className="formLabel">Website</label>
              <input type="url" id="website" name="website" placeholder="https://…" className="formInput" />
            </div>
            <div className="formGroup">
              <label htmlFor="description" className="formLabel">Description</label>
              <textarea id="description" name="description" rows={3} className="formInput" />
            </div>
            <div className="formRow">
              <div className="formGroup">
                <label htmlFor="lead_partner" className="formLabel">Lead partner</label>
                <input type="text" id="lead_partner" name="lead_partner" className="formInput" />
              </div>
              <div className="formGroup">
                <label htmlFor="investment_date" className="formLabel">Investment date</label>
                <input type="date" id="investment_date" name="investment_date" className="formInput" />
              </div>
            </div>
            <div className="formGroup">
              <label htmlFor="notes" className="formLabel">Notes</label>
              <textarea id="notes" name="notes" rows={2} className="formInput" />
            </div>
            <button type="submit" className="primaryButton">Add company</button>
          </form>
        </section>
      </div>
    </div>
  );
}
