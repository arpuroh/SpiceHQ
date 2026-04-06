import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CURATION_RULES } from '@/lib/data/curation';
import { getContactsPageData } from '@/lib/data/contacts';
import { getFundraisingPageData, formatUsd } from '@/lib/data/fundraising';
import { getInteractionsPageData, formatDateTime, formatInteractionSummary } from '@/lib/data/interactions';

export default async function AppPage() {
  const supabase = await createClient();
  const [fundraising, contacts, interactions] = await Promise.all([
    getFundraisingPageData(supabase),
    getContactsPageData(supabase),
    getInteractionsPageData(supabase)
  ]);
  const reviewCount = fundraising.hiddenAccounts + contacts.hiddenContacts + interactions.hiddenInteractions;

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <div className="badge">Live CRM overview</div>
          <h1 style={{ margin: '12px 0 8px', fontSize: 36 }}>Credible CRM views, with the import junk pushed aside.</h1>
          <div className="subtle">
            Default views now prioritize usable records across fundraising, contacts, and interactions while suspect rows stay traceable in review.
          </div>
        </div>
        <div className="buttonRow">
          <Link href="/app/fundraising" className="primaryButton">Open fundraising table</Link>
          <Link href="/app/review" className="secondaryButton">Review hidden rows</Link>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <section className="panel">
          <div className="kpiTitle">Visible fundraising accounts</div>
          <div className="kpiValue">{fundraising.visibleAccounts}</div>
          <div className="metricNote">{fundraising.hiddenAccounts} hidden for review</div>
        </section>
        <section className="panel">
          <div className="kpiTitle">Visible contacts</div>
          <div className="kpiValue">{contacts.visibleContacts}</div>
          <div className="metricNote">{contacts.hiddenContacts} hidden for review</div>
        </section>
        <section className="panel">
          <div className="kpiTitle">Visible interactions</div>
          <div className="kpiValue">{interactions.visibleInteractions}</div>
          <div className="metricNote">{interactions.hiddenInteractions} hidden for review</div>
        </section>
        <section className="panel">
          <div className="kpiTitle">Committed capital</div>
          <div className="kpiValue">{formatUsd(fundraising.totalCommitted)}</div>
          <div className="metricNote">{reviewCount} total suspect rows queued</div>
        </section>
      </div>

      <div className="grid grid-2">
        <section className="panel">
          <h2 className="sectionTitle">Fundraising stage breakdown</h2>
          <div className="stageList">
            {fundraising.stageCounts.length ? fundraising.stageCounts.map((item) => (
              <div key={item.stage} className="stageItem">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{item.stage}</strong>
                  <span className="badge">{item.count}</span>
                </div>
              </div>
            )) : <div className="activityItem">No live rows yet.</div>}
          </div>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">Cleanup rules in default views</h2>
          <div className="activityList">
            {CURATION_RULES.map((rule) => (
              <div key={rule} className="activityItem">{rule}</div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-3" style={{ marginTop: 24 }}>
        <section className="panel">
          <h2 className="sectionTitle">Best fundraising rows</h2>
          <div className="activityList">
            {fundraising.rows.slice(0, 5).map((row) => (
              <div key={row.id} className="activityItem">
                <strong>{row.organization?.name ?? 'Unknown organization'}</strong>
                <div className="tableSubtle">
                  {row.stage} · {formatUsd(row.target_commitment)} target · {row.relationship_temperature ?? 'No temperature'}
                </div>
              </div>
            ))}
            {!fundraising.rows.length ? <div className="activityItem">No usable fundraising rows yet.</div> : null}
          </div>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">Best contacts</h2>
          <div className="activityList">
            {contacts.rows.slice(0, 5).map((row) => (
              <div key={row.id} className="activityItem">
                <strong>{row.full_name ?? `${row.first_name} ${row.last_name ?? ''}`.trim()}</strong>
                <div className="tableSubtle">
                  {row.primary_organization?.name ?? 'No org'} · {row.email ?? row.linkedin_url ?? row.phone ?? 'No direct contact'}
                </div>
              </div>
            ))}
            {!contacts.rows.length ? <div className="activityItem">No usable contact rows yet.</div> : null}
          </div>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">Latest usable interactions</h2>
          <div className="activityList">
            {interactions.rows.slice(0, 5).map((row) => (
              <div key={row.id} className="activityItem">
                <strong>{row.subject ?? row.interaction_type ?? 'Untitled interaction'}</strong>
                <div className="tableSubtle">
                  {formatDateTime(row.occurred_at)} · {formatInteractionSummary(row)}
                </div>
              </div>
            ))}
            {!interactions.rows.length ? <div className="activityItem">No usable interactions yet.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
