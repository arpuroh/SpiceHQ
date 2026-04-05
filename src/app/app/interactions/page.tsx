import { createClient } from '@/lib/supabase/server';
import {
  formatDateTime,
  formatInteractionSummary,
  getInteractionsPageData
} from '@/lib/data/interactions';

export default async function InteractionsPage() {
  const supabase = await createClient();
  const data = await getInteractionsPageData(supabase);

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
        <section className="panel"><div className="kpiTitle">Interactions</div><div className="kpiValue">{data.totalInteractions}</div></section>
        <section className="panel"><div className="kpiTitle">Last 14d</div><div className="kpiValue">{data.recentInteractions}</div></section>
        <section className="panel"><div className="kpiTitle">With contacts</div><div className="kpiValue">{data.withContacts}</div></section>
        <section className="panel"><div className="kpiTitle">With orgs</div><div className="kpiValue">{data.withOrganizations}</div></section>
      </div>

      <section className="panel">
        <h2 className="sectionTitle">Latest interactions</h2>
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
