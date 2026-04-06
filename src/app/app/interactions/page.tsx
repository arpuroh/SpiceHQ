import Link from 'next/link';
import { addInteractionAction } from '@/app/app/actions';
import { EmptyState, FilterSummary, MetricCard, PageHeader } from '@/components/crm-ui';
import { createClient } from '@/lib/supabase/server';
import {
  formatDateTime,
  formatInteractionSummary,
  getInteractionsPageData,
  matchesInteractionQuery
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
  const created = getParam(resolvedSearchParams.created);
  const error = getParam(resolvedSearchParams.error);
  const reviewMode = getParam(resolvedSearchParams.view) === 'review';
  const query = getParam(resolvedSearchParams.q).trim();
  const interactionType = getParam(resolvedSearchParams.type).trim();
  const source = getParam(resolvedSearchParams.source).trim();

  const supabase = await createClient();
  const data = await getInteractionsPageData(supabase);

  const allRows = reviewMode ? data.reviewRows : data.rows;
  const filteredRows = allRows.filter((row) => {
    if (interactionType && (row.interaction_type ?? '') !== interactionType) return false;
    if (source && (row.source_system ?? '') !== source) return false;
    if (!matchesInteractionQuery(row, query)) return false;
    return true;
  });

  const interactionTypeOptions = Array.from(
    new Set(allRows.map((row) => row.interaction_type).filter((value): value is string => Boolean(value)))
  ).sort((a, b) => a.localeCompare(b));
  const sourceOptions = Array.from(
    new Set(allRows.map((row) => row.source_system).filter((value): value is string => Boolean(value)))
  ).sort((a, b) => a.localeCompare(b));
  const activeFilterCount = [query, interactionType, source].filter(Boolean).length;

  return (
    <div className="pageStack">
      <PageHeader
        eyebrow="Interactions"
        title="Recent touches and conversation history"
        description={
          <>
            Verified activity now has a cleaner timeline, with low-confidence or synthetic imports separated into review mode.
            Search and filters help narrow the interaction stream to the conversations that actually matter.
          </>
        }
        meta={
          <>
            <div className="sourceBadge">Source: {data.source === 'supabase' ? 'Supabase' : 'Empty / fallback'}</div>
            <div className="badge">{reviewMode ? 'Review mode' : 'Working timeline'}</div>
          </>
        }
        actions={[
          {
            href: reviewMode ? '/app/interactions' : '/app/interactions?view=review',
            label: reviewMode ? 'Hide review queue' : `Review queue (${data.reviewInteractions})`,
            variant: 'secondary'
          }
        ]}
      />

      {created === 'interaction' ? (
        <div className="successBanner">Interaction logged.</div>
      ) : null}
      {error ? <div className="errorBanner">{error}</div> : null}

      <div className="grid grid-4">
        <MetricCard label="Verified interactions" value={data.verifiedInteractions} note="Primary CRM timeline" tone="accent" />
        <MetricCard label="Review queue" value={data.reviewInteractions} note="Synthetic, redacted, or low-confidence interactions" tone="review" />
        <MetricCard label="Last 14d" value={data.recentInteractions} note="Recent verified activity only" tone="success" />
        <MetricCard label="With contacts" value={data.withContacts} note="Verified rows tied to people context" />
      </div>

      <section className="panel">
        <div className="panelHeader">
          <div className="panelTitleGroup">
            <h2 className="sectionTitle">Log interaction</h2>
            <div className="subtle">Record a meeting, call, email, or note manually.</div>
          </div>
        </div>
        <form action={addInteractionAction} className="stack">
          <div className="formGrid formGrid2">
            <label className="field">
              <span>Subject</span>
              <input name="subject" placeholder="Meeting with Sequoia re: Fund III" />
            </label>
            <label className="field">
              <span>Type</span>
              <select name="interaction_type" defaultValue="meeting">
                <option value="meeting">Meeting</option>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="note">Note</option>
                <option value="intro">Intro</option>
                <option value="follow-up">Follow-up</option>
                <option value="diligence">Diligence</option>
              </select>
            </label>
          </div>

          <div className="formGrid formGrid2">
            <label className="field">
              <span>Date</span>
              <input name="occurred_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </label>
            <label className="field">
              <span>Source</span>
              <select name="source_system" defaultValue="manual">
                <option value="manual">Manual entry</option>
                <option value="gmail">Gmail</option>
                <option value="calendar">Calendar</option>
                <option value="phone">Phone</option>
              </select>
            </label>
          </div>

          <label className="field">
            <span>Summary</span>
            <textarea name="summary" rows={3} placeholder="Key takeaways, next steps, or context for this touchpoint..." />
          </label>

          <div>
            <button type="submit" className="primaryButton">Log interaction</button>
          </div>
        </form>
      </section>

      <section className={`panel${reviewMode ? ' reviewPanel' : ''}`}>
        <div className="panelHeader">
          <div className="panelTitleGroup">
            <h2 className="sectionTitle">{reviewMode ? 'Interaction review queue' : 'Latest verified interactions'}</h2>
            <div className="subtle">
              {reviewMode
                ? 'Held back from the main timeline until source records are cleaned up.'
                : 'Searchable activity stream for relationship work and meeting prep.'}
            </div>
          </div>
          <div className={`statusBadge ${reviewMode ? 'statusBadge-amber' : 'statusBadge-green'}`}>
            {filteredRows.length} {reviewMode ? 'flagged rows' : 'visible rows'}
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
                placeholder="Subject, contact, organization, summary, or stage"
              />
            </label>

            <label className="fieldGroup">
              <span className="fieldLabel">Interaction type</span>
              <select name="type" defaultValue={interactionType}>
                <option value="">All types</option>
                {interactionTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="fieldGroup">
              <span className="fieldLabel">Source</span>
              <select name="source" defaultValue={source}>
                <option value="">All sources</option>
                {sourceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <div className="toolbarActions">
              <button type="submit" className="primaryButton">Apply filters</button>
              <Link href={reviewMode ? '/app/interactions?view=review' : '/app/interactions'} className="secondaryButton">
                Reset
              </Link>
            </div>
          </form>

          <div className="toolbarSummary">
            <FilterSummary
              heading={activeFilterCount ? 'Filtered timeline' : reviewMode ? 'Review queue' : 'Working timeline'}
              detail={
                activeFilterCount
                  ? `${filteredRows.length} matches across ${allRows.length} rows in this view.`
                  : `${allRows.length} rows available in this view.`
              }
            />
            {!reviewMode ? <div className="badge">With orgs: {data.withOrganizations}</div> : <div className="badge">Needs source cleanup</div>}
          </div>
        </div>

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
              {filteredRows.length ? (
                filteredRows.map((row) => {
                  const contactNames = row.contacts
                    .map((contactLink) =>
                      contactLink.contact?.full_name ??
                      [contactLink.contact?.first_name, contactLink.contact?.last_name].filter(Boolean).join(' ')
                    )
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
                        <div>{row.interaction_type ?? '—'}</div>
                        <div className="tableSubtle">{row.source_system ?? 'Unknown source'}</div>
                      </td>
                      <td>
                        <div className="tableTitle">{row.subject ?? 'Untitled interaction'}</div>
                        <div className="tableSubtle">{formatInteractionSummary(row)}</div>
                      </td>
                      <td>{contactNames || '—'}</td>
                      <td>{organizationNames || '—'}</td>
                      <td>{accountStages || '—'}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="No interactions match the current filters"
                      detail={
                        activeFilterCount
                          ? 'Broaden the search, clear a filter, or switch between working and review mode.'
                          : 'No interactions are available in this view yet.'
                      }
                      action={
                        <Link href={reviewMode ? '/app/interactions?view=review' : '/app/interactions'} className="secondaryButton">
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
