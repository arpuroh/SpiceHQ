import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  formatDateTime,
  formatInteractionSummary,
  getInteractionContactName,
  getInteractionsPageData
} from '@/lib/data/interactions';

type InteractionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function InteractionsPage({ searchParams }: InteractionsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = getParam(resolvedSearchParams.q).trim().toLowerCase();
  const organizationFilter = getParam(resolvedSearchParams.organization).trim();
  const supabase = await createClient();
  const data = await getInteractionsPageData(supabase);
  const filteredRows = data.rows.filter((row) => {
    if (organizationFilter && !row.organizations.some((organizationLink) => organizationLink.organization?.id === organizationFilter)) return false;
    if (!query) return true;

    const haystack = [
      row.interaction_type,
      row.source_system,
      row.subject,
      row.summary,
      row.body_preview,
      ...row.contacts.map((contactLink) => getInteractionContactName(contactLink.contact)),
      ...row.organizations.map((organizationLink) => organizationLink.organization?.name ?? null),
      ...row.fundraising_accounts.map((accountLink) => accountLink.fundraising_account?.stage ?? null)
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <div className="badge">Interactions</div>
          <h1 style={{ margin: '12px 0 8px', fontSize: 36 }}>Recent touches and conversation history</h1>
          <div className="subtle">
            Default view suppresses synthetic or context-free activity rows so recent touches look like real relationship history.
          </div>
        </div>
        <div className="buttonRow">
          <div className="badge">Source: {data.source === 'supabase' ? 'Supabase' : 'Empty / fallback'}</div>
          <Link href="/app/review" className="secondaryButton">Review hidden rows</Link>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <section className="panel"><div className="kpiTitle">Visible interactions</div><div className="kpiValue">{data.visibleInteractions}</div><div className="metricNote">{data.hiddenInteractions} hidden</div></section>
        <section className="panel"><div className="kpiTitle">Last 14d</div><div className="kpiValue">{data.recentInteractions}</div></section>
        <section className="panel"><div className="kpiTitle">With contacts</div><div className="kpiValue">{data.withContacts}</div></section>
        <section className="panel"><div className="kpiTitle">With orgs</div><div className="kpiValue">{data.withOrganizations}</div></section>
      </div>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2 className="sectionTitle" style={{ marginBottom: 6 }}>Latest curated interactions</h2>
            <div className="subtle">Ordered to show recent rows with usable summary and relationship context first.</div>
          </div>
          <div className="badge">{data.totalInteractions} imported total</div>
        </div>
        <form method="get" action="/app/interactions" className="filterBar" style={{ marginBottom: 16 }}>
          <input type="text" name="q" placeholder="Search interaction, org, contact, or source…" defaultValue={query} className="filterInput" />
          <select name="organization" defaultValue={organizationFilter} className="filterSelect">
            <option value="">All organizations</option>
            {data.organizationOptions.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
          <button type="submit" className="secondaryButton">Filter</button>
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
              {filteredRows.length ? filteredRows.map((row) => {
                const contactEntries = row.contacts
                  .map((contactLink) => contactLink.contact)
                  .filter(Boolean);
                const organizationEntries = row.organizations
                  .map((organizationLink) => organizationLink.organization)
                  .filter(Boolean);
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
                    <td>
                      {contactEntries.length ? contactEntries.map((contact, index) => (
                        <span key={contact!.id}>
                          {index > 0 ? ' · ' : ''}
                          <Link href={`/app/contacts/${contact!.id}`} className="inlineLink">{getInteractionContactName(contact!)}</Link>
                        </span>
                      )) : '—'}
                    </td>
                    <td>
                      {organizationEntries.length ? organizationEntries.map((organization, index) => (
                        <span key={organization!.id}>
                          {index > 0 ? ' · ' : ''}
                          <Link href={`/app/organizations/${organization!.id}`} className="inlineLink">{organization!.name}</Link>
                        </span>
                      )) : '—'}
                    </td>
                    <td>{accountStages || '—'}</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="subtle">{query || organizationFilter ? 'No interactions match the current filters.' : 'No interaction rows available yet.'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {data.hiddenRows.length ? (
        <section className="panel" style={{ marginTop: 24 }}>
          <div className="panelHeader">
            <div>
              <h2 className="sectionTitle" style={{ marginBottom: 6 }}>Suppressed interactions</h2>
              <div className="subtle">These activity rows remain visible for triage when source data needs repair.</div>
            </div>
            <div className="badge">{data.hiddenRows.length} suspect rows</div>
          </div>

          <div className="activityList">
            {data.hiddenRows.slice(0, 12).map(({ row, reasons }) => (
              <div key={row.id} className="activityItem">
                <strong>{row.subject ?? row.interaction_type ?? 'Untitled interaction'}</strong>
                <div className="tableSubtle">{formatDateTime(row.occurred_at)} · {row.source_system ?? 'Unknown source'}</div>
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
