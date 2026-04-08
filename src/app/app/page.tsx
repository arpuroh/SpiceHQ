import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CURATION_RULES } from '@/lib/data/curation';
import { getContactsPageData } from '@/lib/data/contacts';
import { getFundraisingPageData, formatUsd } from '@/lib/data/fundraising';
import { getInteractionsPageData, formatDateTime, formatInteractionSummary } from '@/lib/data/interactions';
import { getOrganizationsPageData } from '@/lib/data/organizations';

export default async function AppPage() {
  const supabase = await createClient();
  const [organizations, fundraising, contacts, interactions] = await Promise.all([
    getOrganizationsPageData(supabase),
    getFundraisingPageData(supabase),
    getContactsPageData(supabase),
    getInteractionsPageData(supabase)
  ]);
  const reviewCount = organizations.reviewOrganizations + fundraising.hiddenAccounts + contacts.hiddenContacts + interactions.hiddenInteractions;
  const sourceCount = organizations.totalOrganizations + fundraising.totalAccounts + contacts.totalContacts + interactions.totalInteractions;
  const visibleCount = organizations.verifiedOrganizations + fundraising.visibleAccounts + contacts.visibleContacts + interactions.visibleInteractions;

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <div className="badge">Live CRM overview</div>
          <h1 style={{ margin: '12px 0 8px', fontSize: 36 }}>Organization-centered CRM, with the import junk pushed aside.</h1>
          <div className="subtle">
            Start from firms, then move into pipeline, people, and touchpoints. Default views prioritize usable records while suspect rows stay traceable in review.
          </div>
        </div>
        <div className="buttonRow">
          <Link href="/app/organizations" className="primaryButton">Open organizations</Link>
          <Link href="/app/fundraising" className="secondaryButton">Open fundraising</Link>
          <Link href="/app/review" className="secondaryButton">Review hidden rows</Link>
        </div>
      </div>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panelHeader">
          <div>
            <h2 className="sectionTitle" style={{ marginBottom: 6 }}>Source coverage</h2>
            <div className="subtle">Nothing is deleted from the source layer. Working views are a curated subset of imported Airtable/Supabase records.</div>
          </div>
          <div className="badge">{visibleCount} visible / {sourceCount} source rows</div>
        </div>
        <div className="grid grid-4">
          <section className="stageItem">
            <strong>Organizations</strong>
            <div className="tableSubtle">{organizations.verifiedOrganizations} visible · {organizations.reviewOrganizations} in review · {organizations.totalOrganizations} source total</div>
          </section>
          <section className="stageItem">
            <strong>Fundraising</strong>
            <div className="tableSubtle">{fundraising.visibleAccounts} visible · {fundraising.hiddenAccounts} in review · {fundraising.totalAccounts} source total</div>
          </section>
          <section className="stageItem">
            <strong>Contacts</strong>
            <div className="tableSubtle">{contacts.visibleContacts} visible · {contacts.hiddenContacts} in review · {contacts.totalContacts} source total</div>
          </section>
          <section className="stageItem">
            <strong>Interactions</strong>
            <div className="tableSubtle">{interactions.visibleInteractions} visible · {interactions.hiddenInteractions} in review · {interactions.totalInteractions} source total</div>
          </section>
        </div>
      </section>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <section className="panel">
          <div className="kpiTitle">Verified organizations</div>
          <div className="kpiValue">{organizations.verifiedOrganizations}</div>
          <div className="metricNote">{organizations.reviewOrganizations} orgs held for review</div>
        </section>
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
          <div className="kpiTitle">Committed capital</div>
          <div className="kpiValue">{formatUsd(fundraising.totalCommitted)}</div>
          <div className="metricNote">{reviewCount} total suspect rows queued</div>
        </section>
      </div>

      <div className="grid grid-2">
        <section className="panel">
          <h2 className="sectionTitle">Organization command center</h2>
          <div className="activityList">
            {organizations.rows.slice(0, 6).map((row) => (
              <div key={row.id} className="activityItem">
                <div className="splitRow">
                  <Link href={`/app/organizations/${row.id}`} className="tableTitle">{row.name}</Link>
                  <span className="badge">
                    {row.contact_count + row.fundraising_count + row.interaction_count + row.task_count + row.note_count + row.portfolio_count} linked items
                  </span>
                </div>
                <div className="tableSubtle">
                  {[
                    row.organization_type,
                    row.headquarters,
                    row.last_interaction_at ? `Last touch ${formatDateTime(row.last_interaction_at)}` : null
                  ].filter(Boolean).join(' · ') || 'No profile context yet'}
                </div>
                <div className="contextLinksRow" style={{ marginTop: 10 }}>
                  <Link href={`/app/fundraising?organization=${row.id}`} className="inlineLink">Pipeline ({row.fundraising_count})</Link>
                  <span>·</span>
                  <Link href={`/app/contacts?organization=${row.id}`} className="inlineLink">Contacts ({row.contact_count})</Link>
                  <span>·</span>
                  <Link href={`/app/interactions?organization=${row.id}`} className="inlineLink">Interactions ({row.interaction_count})</Link>
                  <span>·</span>
                  <Link href={`/app/tasks?organization=${row.id}`} className="inlineLink">Tasks ({row.task_count})</Link>
                  <span>·</span>
                  <Link href={`/app/notes?organization=${row.id}`} className="inlineLink">Notes ({row.note_count})</Link>
                </div>
              </div>
            ))}
            {!organizations.rows.length ? <div className="activityItem">No usable organization rows yet.</div> : null}
          </div>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">Organization coverage</h2>
          <div className="stageList">
            <div className="stageItem">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>With contacts</strong>
                <span className="badge">{organizations.withContacts}</span>
              </div>
            </div>
            <div className="stageItem">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>With fundraising</strong>
                <span className="badge">{organizations.withFundraising}</span>
              </div>
            </div>
            <div className="stageItem">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Visible interactions</strong>
                <span className="badge">{interactions.visibleInteractions}</span>
              </div>
            </div>
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
          <h2 className="sectionTitle">Best organizations</h2>
          <div className="activityList">
            {organizations.rows.slice(0, 5).map((row) => (
              <div key={row.id} className="activityItem">
                <Link href={`/app/organizations/${row.id}`} className="tableTitle">{row.name}</Link>
                <div className="tableSubtle">
                  {[
                    row.organization_type,
                    row.headquarters,
                    row.contact_count ? `${row.contact_count} contact${row.contact_count === 1 ? '' : 's'}` : null,
                    row.fundraising_count ? `${row.fundraising_count} pipeline row${row.fundraising_count === 1 ? '' : 's'}` : null
                  ].filter(Boolean).join(' · ') || 'No extra context yet'}
                </div>
              </div>
            ))}
            {!organizations.rows.length ? <div className="activityItem">No usable organization rows yet.</div> : null}
          </div>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">Best fundraising rows</h2>
          <div className="activityList">
            {fundraising.rows.slice(0, 5).map((row) => (
              <div key={row.id} className="activityItem">
                {row.organization ? <Link href={`/app/organizations/${row.organization.id}`} className="tableTitle">{row.organization.name}</Link> : <strong>Unknown organization</strong>}
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
                <Link href={`/app/contacts/${row.id}`} className="tableTitle">{row.full_name ?? `${row.first_name} ${row.last_name ?? ''}`.trim()}</Link>
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
