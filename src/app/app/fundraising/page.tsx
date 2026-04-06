import Link from 'next/link';
import { EmptyState, FilterSummary, MetricCard, PageHeader } from '@/components/crm-ui';
import { createClient } from '@/lib/supabase/server';
import { formatUsd, getFundraisingPageData, matchesFundraisingQuery } from '@/lib/data/fundraising';
import { formatReviewFlags } from '@/lib/data/record-quality';

type FundraisingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function FundraisingPage({ searchParams }: FundraisingPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const saved = getParam(resolvedSearchParams.saved);
  const error = getParam(resolvedSearchParams.error);
  const reviewMode = getParam(resolvedSearchParams.view) === 'review';
  const query = getParam(resolvedSearchParams.q).trim();
  const stage = getParam(resolvedSearchParams.stage).trim();
  const organizationType = getParam(resolvedSearchParams.type).trim();
  const status = getParam(resolvedSearchParams.status).trim();

  const supabase = await createClient();
  const data = await getFundraisingPageData(supabase);

  const allRows = reviewMode ? data.reviewRows : data.rows;
  const filteredRows = allRows.filter((row) => {
    if (stage && row.stage !== stage) return false;
    if (organizationType && (row.organization?.organization_type ?? '') !== organizationType) return false;
    if (status && row.status !== status) return false;
    if (!matchesFundraisingQuery(row, query)) return false;
    return true;
  });

  const stageOptions = Array.from(new Set(allRows.map((row) => row.stage).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const typeOptions = Array.from(
    new Set(allRows.map((row) => row.organization?.organization_type).filter((value): value is string => Boolean(value)))
  ).sort((a, b) => a.localeCompare(b));
  const statusOptions = Array.from(new Set(allRows.map((row) => row.status).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  const activeFilterCount = [query, stage, organizationType, status].filter(Boolean).length;
  const resultLabel = reviewMode ? 'flagged rows' : 'visible rows';

  return (
    <div className="pageStack">
      <PageHeader
        eyebrow="Fundraising"
        title="Verified investor pipeline"
        description={
          <>
            The default view focuses on real organizations and active fundraising records. Search and filters make it practical to
            work the pipeline, while review mode keeps inactive or synthetic rows available without letting them dominate the table.
          </>
        }
        meta={
          <>
            <div className="sourceBadge">Source: {data.source === 'supabase' ? 'Supabase' : 'Empty / fallback'}</div>
            <div className="badge">{reviewMode ? 'Review mode' : 'Primary pipeline'}</div>
          </>
        }
        actions={[
          {
            href: reviewMode ? '/app/fundraising' : '/app/fundraising?view=review',
            label: reviewMode ? 'Hide review queue' : `Review queue (${data.reviewAccounts})`,
            variant: 'secondary'
          }
        ]}
      />

      {saved ? <div className="successBanner">Pipeline record updated.</div> : null}
      {error ? <div className="errorBanner">{error}</div> : null}

      <div className="grid grid-4">
        <MetricCard label="Verified accounts" value={data.verifiedAccounts} note="Active and credible pipeline rows" tone="accent" />
        <MetricCard label="Review queue" value={data.reviewAccounts} note="Inactive, fake, or redacted fundraising rows" tone="review" />
        <MetricCard label="Soft circled" value={formatUsd(data.totalSoftCircled)} note="Verified active accounts only" tone="success" />
        <MetricCard label="Committed" value={formatUsd(data.totalCommitted)} note="Current committed total in the working pipeline" />
      </div>

      <div className="grid grid-2">
        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Stage mix</h2>
              <div className="subtle">Current verified pipeline by stage.</div>
            </div>
          </div>
          <div className="stageList">
            {data.stageCounts.length ? (
              data.stageCounts.map((item) => (
                <div key={item.stage} className="stageItem">
                  <div className="splitRow">
                    <strong>{item.stage}</strong>
                    <span className="badge">{item.count}</span>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No verified fundraising rows"
                detail="Once active investor accounts are available, the pipeline stage mix will show up here."
              />
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Pipeline posture</h2>
              <div className="subtle">Quick operating summary from the cleaned dataset.</div>
            </div>
          </div>
          <div className="activityList">
            <div className="activityItem">Active accounts in default view: <strong>{data.activeAccounts}</strong></div>
            <div className="activityItem">Total target across verified accounts: <strong>{formatUsd(data.totalTarget)}</strong></div>
            <div className="activityItem">Imported accounts held in review: <strong>{data.reviewAccounts}</strong></div>
            <div className="activityItem">Organizations in the database: <strong>{data.totalOrganizations}</strong></div>
          </div>
        </section>
      </div>

      <section className={`panel${reviewMode ? ' reviewPanel' : ''}`}>
        <div className="panelHeader">
          <div className="panelTitleGroup">
            <h2 className="sectionTitle">{reviewMode ? 'Fundraising review queue' : 'Primary pipeline'}</h2>
            <div className="subtle">
              {reviewMode
                ? 'Flagged records held back from the main fundraising workflow.'
                : 'Searchable working table sorted from the verified fundraising dataset.'}
            </div>
          </div>
          <div className={`statusBadge ${reviewMode ? 'statusBadge-amber' : 'statusBadge-green'}`}>
            {filteredRows.length} {resultLabel}
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
                placeholder="Investor, memo, stage, HQ, or tag"
              />
            </label>

            <label className="fieldGroup">
              <span className="fieldLabel">Stage</span>
              <select name="stage" defaultValue={stage}>
                <option value="">All stages</option>
                {stageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="fieldGroup">
              <span className="fieldLabel">Organization type</span>
              <select name="type" defaultValue={organizationType}>
                <option value="">All types</option>
                {typeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
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

            <div className="toolbarActions">
              <button type="submit" className="primaryButton">Apply filters</button>
              <Link href={reviewMode ? '/app/fundraising?view=review' : '/app/fundraising'} className="secondaryButton">
                Reset
              </Link>
            </div>
          </form>

          <div className="toolbarSummary">
            <FilterSummary
              heading={activeFilterCount ? 'Filtered results' : reviewMode ? 'Review queue' : 'Working set'}
              detail={
                activeFilterCount
                  ? `${filteredRows.length} matches across ${allRows.length} ${resultLabel}.`
                  : `${allRows.length} ${resultLabel} available in this view.`
              }
            />
            {!reviewMode ? <div className="badge">Verified rows sorted by target commitment</div> : <div className="badge">Flags and cleanup targets</div>}
          </div>
        </div>

        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Investor</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Type</th>
                <th>HQ</th>
                <th>Target</th>
                <th>Soft circled</th>
                <th>Committed</th>
                <th>{reviewMode ? 'Flags' : 'Notes'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.organization ? (
                        <Link href={`/app/organizations/${row.organization.id}`} className="tableTitle">
                          {row.organization.name}
                        </Link>
                      ) : (
                        <div className="tableTitle">Unknown organization</div>
                      )}
                      <div className="tableSubtle">
                        {row.organization?.tags?.slice(0, 3).join(' · ') || 'No tags yet'}
                      </div>
                    </td>
                    <td>{row.stage}</td>
                    <td>
                      <div>{row.status}</div>
                      <div className="tableSubtle">{row.relationship_temperature ?? 'No temperature set'}</div>
                    </td>
                    <td>{row.organization?.organization_type ?? '—'}</td>
                    <td>{row.organization?.headquarters ?? '—'}</td>
                    <td>{formatUsd(row.target_commitment)}</td>
                    <td>{formatUsd(row.soft_circled_amount)}</td>
                    <td>{formatUsd(row.committed_amount)}</td>
                    <td className="tableNote">
                      {reviewMode
                        ? formatReviewFlags(row.review_flags).join(' · ') || 'Needs review'
                        : row.memo ?? '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title="No fundraising rows match the current filters"
                      detail={
                        activeFilterCount
                          ? 'Try broadening the search, clearing one of the filters, or switching between primary and review mode.'
                          : 'No fundraising rows are available in this view yet.'
                      }
                      action={
                        <Link href={reviewMode ? '/app/fundraising?view=review' : '/app/fundraising'} className="secondaryButton">
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
