import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CURATION_RULES } from '@/lib/data/curation';
import { formatDateTime, getContactsPageData } from '@/lib/data/contacts';
import { formatUsd, getFundraisingPageData } from '@/lib/data/fundraising';
import {
  formatInteractionSummary,
  getInteractionsPageData
} from '@/lib/data/interactions';

export default async function ReviewPage() {
  const supabase = await createClient();
  const [contacts, fundraising, interactions] = await Promise.all([
    getContactsPageData(supabase),
    getFundraisingPageData(supabase),
    getInteractionsPageData(supabase)
  ]);

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <div className="badge">Review queue</div>
          <h1 style={{ margin: '12px 0 8px', fontSize: 36 }}>Hidden rows and cleanup triage</h1>
          <div className="subtle">
            Nothing is deleted here. This queue exists so the main CRM stays credible while suspect rows remain reviewable.
          </div>
        </div>
        <Link href="/app" className="secondaryButton">Back to overview</Link>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <section className="panel"><div className="kpiTitle">Hidden contacts</div><div className="kpiValue">{contacts.hiddenContacts}</div></section>
        <section className="panel"><div className="kpiTitle">Hidden fundraising</div><div className="kpiValue">{fundraising.hiddenAccounts}</div></section>
        <section className="panel"><div className="kpiTitle">Hidden interactions</div><div className="kpiValue">{interactions.hiddenInteractions}</div></section>
        <section className="panel"><div className="kpiTitle">Rules active</div><div className="kpiValue">{CURATION_RULES.length}</div></section>
      </div>

      <section className="panel" style={{ marginBottom: 24 }}>
        <h2 className="sectionTitle">Active cleanup rules</h2>
        <div className="activityList">
          {CURATION_RULES.map((rule) => (
            <div key={rule} className="activityItem">{rule}</div>
          ))}
        </div>
      </section>

      <div className="grid grid-3">
        <section className="panel">
          <h2 className="sectionTitle">Contacts needing review</h2>
          <div className="activityList">
            {contacts.hiddenRows.length ? contacts.hiddenRows.map(({ row, reasons }) => (
              <div key={row.id} className="activityItem">
                <strong>{row.full_name ?? (`${row.first_name} ${row.last_name ?? ''}`.trim() || 'Unnamed contact')}</strong>
                <div className="tableSubtle">
                  {row.email ?? row.primary_organization?.name ?? 'No verified contact context'}
                </div>
                <div className="pillRow">
                  {reasons.map((reason) => (
                    <span key={`${row.id}-${reason.code}`} className="reasonPill">{reason.label}</span>
                  ))}
                </div>
                <Link href={`/app/contacts/${row.id}`} className="secondaryButton">Open contact</Link>
              </div>
            )) : <div className="activityItem">No hidden contacts.</div>}
          </div>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">Fundraising needing review</h2>
          <div className="activityList">
            {fundraising.hiddenRows.length ? fundraising.hiddenRows.map(({ row, reasons }) => (
              <div key={row.id} className="activityItem">
                <strong>{row.organization?.name ?? 'Unknown organization'}</strong>
                <div className="tableSubtle">{row.stage} · {formatUsd(row.target_commitment)} target</div>
                <div className="pillRow">
                  {reasons.map((reason) => (
                    <span key={`${row.id}-${reason.code}`} className="reasonPill">{reason.label}</span>
                  ))}
                </div>
              </div>
            )) : <div className="activityItem">No hidden fundraising rows.</div>}
          </div>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">Interactions needing review</h2>
          <div className="activityList">
            {interactions.hiddenRows.length ? interactions.hiddenRows.map(({ row, reasons }) => (
              <div key={row.id} className="activityItem">
                <strong>{row.subject ?? row.interaction_type ?? 'Untitled interaction'}</strong>
                <div className="tableSubtle">
                  {formatDateTime(row.occurred_at)} · {formatInteractionSummary(row)}
                </div>
                <div className="pillRow">
                  {reasons.map((reason) => (
                    <span key={`${row.id}-${reason.code}`} className="reasonPill">{reason.label}</span>
                  ))}
                </div>
              </div>
            )) : <div className="activityItem">No hidden interactions.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
