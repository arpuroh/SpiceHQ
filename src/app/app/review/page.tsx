import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CURATION_RULES } from '@/lib/data/curation';
import { formatDateTime, getContactsPageData } from '@/lib/data/contacts';
import { formatUsd, getFundraisingPageData } from '@/lib/data/fundraising';
import {
  formatInteractionSummary,
  getInteractionsPageData
} from '@/lib/data/interactions';
import { getOrganizationsPageData } from '@/lib/data/organizations';
import { getNotesPageData, getNotePreview } from '@/lib/data/notes';
import { getTasksPageData } from '@/lib/data/tasks';
import { getPortfolioPageData } from '@/lib/data/portfolio';

type ReviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = getParam(resolvedSearchParams.q).trim().toLowerCase();
  const supabase = await createClient();
  const [organizations, contacts, fundraising, interactions, notes, tasks, portfolio] = await Promise.all([
    getOrganizationsPageData(supabase),
    getContactsPageData(supabase),
    getFundraisingPageData(supabase),
    getInteractionsPageData(supabase),
    getNotesPageData(supabase),
    getTasksPageData(supabase),
    getPortfolioPageData(supabase)
  ]);

  const totalHidden =
    organizations.reviewOrganizations +
    contacts.hiddenContacts +
    fundraising.hiddenAccounts +
    interactions.hiddenInteractions +
    notes.reviewNotes +
    tasks.reviewTasks +
    portfolio.reviewCompanies;

  const matchesQuery = (...values: Array<string | null | undefined>) => {
    if (!query) return true;
    return values.filter(Boolean).join(' ').toLowerCase().includes(query);
  };

  const filteredReviewOrganizations = organizations.reviewRows.filter((row) =>
    matchesQuery(row.name, row.organization_type, row.headquarters, row.description, row.website)
  );
  const filteredReviewContacts = contacts.hiddenRows.filter(({ row, reasons }) =>
    matchesQuery(
      row.full_name,
      row.first_name,
      row.last_name,
      row.email,
      row.primary_organization?.name,
      reasons.map((reason) => reason.label).join(' ')
    )
  );
  const filteredReviewFundraising = fundraising.hiddenRows.filter(({ row, reasons }) =>
    matchesQuery(
      row.organization?.name,
      row.organization?.organization_type,
      row.stage,
      row.status,
      row.memo,
      reasons.map((reason) => reason.label).join(' ')
    )
  );
  const filteredReviewInteractions = interactions.hiddenRows.filter(({ row, reasons }) =>
    matchesQuery(
      row.subject,
      row.interaction_type,
      row.summary,
      row.body_preview,
      reasons.map((reason) => reason.label).join(' ')
    )
  );
  const filteredReviewNotes = notes.hiddenRows.filter(({ row, reasons }) =>
    matchesQuery(row.title, row.body, row.organization?.name, row.contact?.full_name, reasons.map((reason) => reason.label).join(' '))
  );
  const filteredReviewTasks = tasks.hiddenRows.filter(({ row, reasons }) =>
    matchesQuery(row.title, row.description, row.organization?.name, row.contact?.full_name, reasons.map((reason) => reason.label).join(' '))
  );
  const filteredReviewPortfolio = portfolio.hiddenRows.filter(({ row, reasons }) =>
    matchesQuery(row.company_name, row.sector, row.stage, row.notes, reasons.map((reason) => reason.label).join(' '))
  );

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
        <section className="panel"><div className="kpiTitle">Hidden organizations</div><div className="kpiValue">{organizations.reviewOrganizations}</div><div className="metricNote">{organizations.verifiedOrganizations} visible · {organizations.totalOrganizations} source total</div></section>
        <section className="panel"><div className="kpiTitle">Hidden contacts</div><div className="kpiValue">{contacts.hiddenContacts}</div><div className="metricNote">{contacts.visibleContacts} visible · {contacts.totalContacts} source total</div></section>
        <section className="panel"><div className="kpiTitle">Hidden fundraising</div><div className="kpiValue">{fundraising.hiddenAccounts}</div><div className="metricNote">{fundraising.visibleAccounts} visible · {fundraising.totalAccounts} source total</div></section>
        <section className="panel"><div className="kpiTitle">Hidden interactions</div><div className="kpiValue">{interactions.hiddenInteractions}</div><div className="metricNote">{interactions.visibleInteractions} visible · {interactions.totalInteractions} source total</div></section>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <section className="panel"><div className="kpiTitle">Hidden notes</div><div className="kpiValue">{notes.reviewNotes}</div><div className="metricNote">{notes.verifiedNotes} visible · {notes.totalNotes} source total</div></section>
        <section className="panel"><div className="kpiTitle">Hidden tasks</div><div className="kpiValue">{tasks.reviewTasks}</div><div className="metricNote">{tasks.verifiedTasks} visible · {tasks.totalTasks} source total</div></section>
        <section className="panel"><div className="kpiTitle">Hidden portfolio</div><div className="kpiValue">{portfolio.reviewCompanies}</div><div className="metricNote">{portfolio.verifiedCompanies} visible · {portfolio.totalCompanies} source total</div></section>
        <section className="panel"><div className="kpiTitle">Total suppressed</div><div className="kpiValue">{totalHidden}</div><div className="metricNote">{CURATION_RULES.length} cleanup rules active</div></section>
      </div>

      <section className="panel" style={{ marginBottom: 24 }}>
        <form method="get" action="/app/review" className="filterBar" style={{ marginBottom: 16 }}>
          <input type="text" name="q" placeholder="Search hidden orgs, contacts, notes, tasks, or reasons…" defaultValue={query} className="filterInput" />
          <button type="submit" className="secondaryButton">Search review</button>
          <Link href="/app/review" className="secondaryButton">Reset</Link>
        </form>
        <h2 className="sectionTitle">Active cleanup rules</h2>
        <div className="activityList">
          {CURATION_RULES.map((rule) => (
            <div key={rule} className="activityItem">{rule}</div>
          ))}
        </div>
      </section>

      <div className="grid grid-3">
        <section className="panel">
          <h2 className="sectionTitle">Organizations needing review</h2>
          <div className="activityList">
            {filteredReviewOrganizations.length ? filteredReviewOrganizations.map((row) => (
              <div key={row.id} className="activityItem">
                <strong>{row.name}</strong>
                <div className="tableSubtle">{row.organization_type ?? 'Unknown type'} · {row.headquarters ?? 'No headquarters'}</div>
                <div className="pillRow">
                  {row.review_flags.map((flag) => (
                    <span key={`${row.id}-${flag}`} className="reasonPill">{flag.replaceAll('_', ' ')}</span>
                  ))}
                </div>
                <Link href={`/app/organizations/${row.id}`} className="secondaryButton">Open organization</Link>
              </div>
            )) : <div className="activityItem">No hidden organizations{query ? ' match this search.' : '.'}</div>}
          </div>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">Contacts needing review</h2>
          <div className="activityList">
            {filteredReviewContacts.length ? filteredReviewContacts.map(({ row, reasons }) => (
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
            )) : <div className="activityItem">No hidden contacts{query ? ' match this search.' : '.'}</div>}
          </div>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">Fundraising needing review</h2>
          <div className="activityList">
            {filteredReviewFundraising.length ? filteredReviewFundraising.map(({ row, reasons }) => (
              <div key={row.id} className="activityItem">
                <strong>{row.organization?.name ?? 'Unknown organization'}</strong>
                <div className="tableSubtle">{row.stage} · {formatUsd(row.target_commitment)} target</div>
                <div className="pillRow">
                  {reasons.map((reason) => (
                    <span key={`${row.id}-${reason.code}`} className="reasonPill">{reason.label}</span>
                  ))}
                </div>
              </div>
            )) : <div className="activityItem">No hidden fundraising rows{query ? ' match this search.' : '.'}</div>}
          </div>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">Interactions needing review</h2>
          <div className="activityList">
            {filteredReviewInteractions.length ? filteredReviewInteractions.map(({ row, reasons }) => (
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
            )) : <div className="activityItem">No hidden interactions{query ? ' match this search.' : '.'}</div>}
          </div>
        </section>
      </div>

      <div className="grid grid-3" style={{ marginTop: 24 }}>
        <section className="panel">
          <h2 className="sectionTitle">Notes needing review</h2>
          <div className="activityList">
            {filteredReviewNotes.length ? filteredReviewNotes.map(({ row, reasons }) => (
              <div key={row.id} className="activityItem">
                <strong>{row.title ?? 'Untitled note'}</strong>
                <div className="tableSubtle">{getNotePreview(row.body)}</div>
                <div className="pillRow">
                  {reasons.map((reason) => (
                    <span key={`${row.id}-${reason.code}`} className="reasonPill">{reason.label}</span>
                  ))}
                </div>
                <Link href="/app/notes?view=review" className="secondaryButton">Open notes review</Link>
              </div>
            )) : <div className="activityItem">No hidden notes{query ? ' match this search.' : '.'}</div>}
          </div>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">Tasks needing review</h2>
          <div className="activityList">
            {filteredReviewTasks.length ? filteredReviewTasks.map(({ row, reasons }) => (
              <div key={row.id} className="activityItem">
                <strong>{row.title}</strong>
                <div className="tableSubtle">{row.organization?.name ?? row.contact?.full_name ?? 'No linked context'} · {row.status ?? 'open'}</div>
                <div className="pillRow">
                  {reasons.map((reason) => (
                    <span key={`${row.id}-${reason.code}`} className="reasonPill">{reason.label}</span>
                  ))}
                </div>
                <Link href="/app/tasks?view=review" className="secondaryButton">Open tasks review</Link>
              </div>
            )) : <div className="activityItem">No hidden tasks{query ? ' match this search.' : '.'}</div>}
          </div>
        </section>

        <section className="panel">
          <h2 className="sectionTitle">Portfolio needing review</h2>
          <div className="activityList">
            {filteredReviewPortfolio.length ? filteredReviewPortfolio.map(({ row, reasons }) => (
              <div key={row.id} className="activityItem">
                <strong>{row.company_name}</strong>
                <div className="tableSubtle">{row.stage ?? 'No stage'} · {row.sector ?? 'No sector'} · {formatUsd(row.investment_amount)}</div>
                <div className="pillRow">
                  {reasons.map((reason) => (
                    <span key={`${row.id}-${reason.code}`} className="reasonPill">{reason.label}</span>
                  ))}
                </div>
                <Link href="/app/portfolio?view=review" className="secondaryButton">Open portfolio review</Link>
              </div>
            )) : <div className="activityItem">No hidden portfolio rows{query ? ' match this search.' : '.'}</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
