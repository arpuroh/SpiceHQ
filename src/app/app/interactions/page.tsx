import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  formatDateTime,
  formatInteractionSummary,
  getInteractionsPageData
} from '@/lib/data/interactions';
import { getSearchParam, normalizeDateFilter, normalizeOptionalFilter } from '@/lib/data/filters';

type InteractionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InteractionsPage({ searchParams }: InteractionsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = {
    query: normalizeOptionalFilter(getSearchParam(resolvedSearchParams.q)),
    interactionType: normalizeOptionalFilter(getSearchParam(resolvedSearchParams.interaction_type)),
    sourceSystem: normalizeOptionalFilter(getSearchParam(resolvedSearchParams.source_system)),
    accountStage: normalizeOptionalFilter(getSearchParam(resolvedSearchParams.account_stage)),
    fromDate: normalizeDateFilter(getSearchParam(resolvedSearchParams.from_date)),
    toDate: normalizeDateFilter(getSearchParam(resolvedSearchParams.to_date))
  };
  const supabase = await createClient();
  const data = await getInteractionsPageData(supabase, filters);

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <div className="badge">Interactions</div>
          <h1 style={{ margin: '12px 0 8px', fontSize: 36 }}>Recent touches and conversation history</h1>
          <div className="subtle">
            Meetings, intros, and relationship events are now visible in one place, tied back to people and organizations.
          </div>
        </div>
        <div className="badge">Source: {data.source === 'supabase' ? 'Supabase' : 'Empty / fallback'}</div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <section className="panel"><div className="kpiTitle">Interactions</div><div className="kpiValue">{data.filteredInteractions}</div></section>
        <section className="panel"><div className="kpiTitle">Last 14d</div><div className="kpiValue">{data.recentInteractions}</div></section>
        <section className="panel"><div className="kpiTitle">With contacts</div><div className="kpiValue">{data.withContacts}</div></section>
        <section className="panel"><div className="kpiTitle">With orgs</div><div className="kpiValue">{data.withOrganizations}</div></section>
      </div>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2 className="sectionTitle">Latest interactions</h2>
            <div className="subtle">
              Showing {data.filteredInteractions} of {data.totalInteractions} interactions
              {data.activeFilterCount ? ` with ${data.activeFilterCount} active filter${data.activeFilterCount === 1 ? '' : 's'}` : ''}.
            </div>
          </div>
          {data.activeFilterCount ? (
            <Link href="/app/interactions" className="secondaryButton">Clear filters</Link>
          ) : null}
        </div>

        <form className="filterPanel">
          <div className="filterGrid filterGrid3">
            <label className="field">
              <span>Search</span>
              <input
                name="q"
                defaultValue={filters.query ?? ''}
                placeholder="Subject, summary, contact, organization"
              />
            </label>

            <label className="field">
              <span>Type</span>
              <select name="interaction_type" defaultValue={filters.interactionType ?? ''}>
                <option value="">All types</option>
                {data.filterOptions.interactionTypes.map((interactionType) => (
                  <option key={interactionType} value={interactionType}>{interactionType}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Source</span>
              <select name="source_system" defaultValue={filters.sourceSystem ?? ''}>
                <option value="">All sources</option>
                {data.filterOptions.sourceSystems.map((sourceSystem) => (
                  <option key={sourceSystem} value={sourceSystem}>{sourceSystem}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Fundraising stage</span>
              <select name="account_stage" defaultValue={filters.accountStage ?? ''}>
                <option value="">Any stage</option>
                {data.filterOptions.accountStages.map((accountStage) => (
                  <option key={accountStage} value={accountStage}>{accountStage}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>From date</span>
              <input name="from_date" type="date" defaultValue={filters.fromDate ?? ''} />
            </label>

            <label className="field">
              <span>To date</span>
              <input name="to_date" type="date" defaultValue={filters.toDate ?? ''} />
            </label>
          </div>

          <div className="buttonRow">
            <button type="submit" className="primaryButton">Apply filters</button>
            {data.activeFilterCount ? (
              <Link href="/app/interactions" className="secondaryButton">Reset</Link>
            ) : null}
          </div>
        </form>

        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Summary</th>
                <th>Contacts</th>
                <th>Organizations</th>
                <th>Fundraising</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length ? data.rows.map((row) => {
                const contactNames = row.contacts
                  .map((contactLink) => contactLink.contact?.full_name ?? [contactLink.contact?.first_name, contactLink.contact?.last_name].filter(Boolean).join(' '))
                  .filter(Boolean)
                  .join(' · ');
                const organizationNames = row.organizations
                  .map((organizationLink) => organizationLink.organization?.name)
                  .filter(Boolean)
                  .join(' · ');
                const accountStages = row.fundraising_accounts
                  .map((accountLink) => accountLink.fundraising_account?.stage)
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.occurred_at)}</td>
                    <td>
                      {row.interaction_type ?? '—'}
                      <div className="tableSubtle">{row.source_system ?? 'Unknown source'}</div>
                    </td>
                    <td>
                      <strong>{row.subject ?? 'Untitled interaction'}</strong>
                      <div className="tableSubtle">{formatInteractionSummary(row)}</div>
                    </td>
                    <td>{contactNames || '—'}</td>
                    <td>{organizationNames || '—'}</td>
                    <td>{accountStages || '—'}</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="subtle">No interaction rows available yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
