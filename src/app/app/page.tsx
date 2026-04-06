import Link from 'next/link';
import { PageHeader, MetricCard } from '@/components/crm-ui';
import { createClient } from '@/lib/supabase/server';
import { getFundraisingPageData, formatUsd } from '@/lib/data/fundraising';
import { getContactsPageData, formatDateTime, getContactDisplayName } from '@/lib/data/contacts';
import { formatInteractionSummary, getInteractionsPageData } from '@/lib/data/interactions';
import { getOrganizationsPageData } from '@/lib/data/organizations';
import { getPortfolioPageData } from '@/lib/data/portfolio';
import { getTasksPageData } from '@/lib/data/tasks';
import { getNotesPageData } from '@/lib/data/notes';

export default async function AppPage() {
  const supabase = await createClient();
  const [fundraising, contacts, interactions, organizations, portfolio, tasks, notes] = await Promise.all([
    getFundraisingPageData(supabase),
    getContactsPageData(supabase),
    getInteractionsPageData(supabase),
    getOrganizationsPageData(supabase),
    getPortfolioPageData(supabase),
    getTasksPageData(supabase),
    getNotesPageData(supabase)
  ]);

  const spotlightRows = fundraising.rows.slice(0, 5);
  const latestContacts = contacts.rows.slice(0, 4);
  const latestInteractions = interactions.rows.slice(0, 4);
  const totalReviewQueue = fundraising.reviewAccounts + contacts.reviewContacts + interactions.reviewInteractions + organizations.reviewOrganizations;

  return (
    <div className="pageStack">
      <PageHeader
        eyebrow="Overview"
        title="A cleaner operating view for fundraising and relationship work"
        description={
          <>
            Core CRM views now prioritize verified organizations, usable people records, and real interaction history.
            Lower-confidence imports remain accessible through review mode without crowding the day-to-day workflow.
          </>
        }
        meta={
          <>
            <div className="sourceBadge">Supabase-backed workspace</div>
            <div className="badge">Review queue: {totalReviewQueue}</div>
          </>
        }
        actions={[
          { href: '/app/fundraising', label: 'Open fundraising' },
          { href: '/app/contacts?view=review', label: 'Review queue', variant: 'secondary' }
        ]}
      />

      <div className="grid grid-4">
        <MetricCard
          label="Verified investor accounts"
          value={fundraising.verifiedAccounts}
          note={`of ${fundraising.totalAccounts} imported fundraising rows`}
          tone="accent"
        />
        <MetricCard
          label="Active pipeline"
          value={fundraising.activeAccounts}
          note="Primary fundraising rows with active stages and statuses"
        />
        <MetricCard
          label="Soft circled"
          value={formatUsd(fundraising.totalSoftCircled)}
          note="Verified active accounts only"
          tone="success"
        />
        <MetricCard
          label="Review queue"
          value={totalReviewQueue}
          note="Contacts, interactions, and fundraising records needing triage"
          tone="review"
        />
      </div>

      <div className="grid grid-3">
        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Pipeline snapshot</h2>
              <div className="subtle">Current verified fundraising posture.</div>
            </div>
            <Link href="/app/fundraising" className="inlineLink">Open pipeline</Link>
          </div>
          <div className="insightList">
            <div className="insightItem">
              <span className="insightValue">Target</span>
              <div>{formatUsd(fundraising.totalTarget)} across verified investor accounts.</div>
            </div>
            <div className="insightItem">
              <span className="insightValue">Committed</span>
              <div>{formatUsd(fundraising.totalCommitted)} currently logged in the clean pipeline.</div>
            </div>
            <div className="insightItem">
              <span className="insightValue">Stage coverage</span>
              <div>{fundraising.stageCounts.length} active stages represented in the current pipeline.</div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Data health</h2>
              <div className="subtle">Clean views stay separate from raw imports.</div>
            </div>
          </div>
          <div className="activityList">
            <div className="activityItem">
              Organizations in directory: <strong>{organizations.verifiedOrganizations}</strong>
              <div className="tableSubtle">{organizations.reviewOrganizations} in review. <Link href="/app/organizations" className="inlineLink">Open directory</Link></div>
            </div>
            <div className="activityItem">
              Contacts in working view: <strong>{contacts.verifiedContacts}</strong>
              <div className="tableSubtle">{contacts.reviewContacts} routed to review.</div>
            </div>
            <div className="activityItem">
              Interactions in working view: <strong>{interactions.verifiedInteractions}</strong>
              <div className="tableSubtle">{interactions.reviewInteractions} held back for cleanup.</div>
            </div>
            <div className="activityItem">
              Fundraising rows in working view: <strong>{fundraising.verifiedAccounts}</strong>
              <div className="tableSubtle">{fundraising.reviewAccounts} excluded from the primary pipeline.</div>
            </div>
            <div className="activityItem">
              Portfolio companies: <strong>{portfolio.activeCompanies}</strong>
              <div className="tableSubtle">{portfolio.totalCompanies} total. <Link href="/app/portfolio" className="inlineLink">Open portfolio</Link></div>
            </div>
            <div className="activityItem">
              Open tasks: <strong>{tasks.openTasks}</strong>
              <div className="tableSubtle">{tasks.overdueTasks} overdue. <Link href="/app/tasks" className="inlineLink">Open tasks</Link></div>
            </div>
            <div className="activityItem">
              Notes: <strong>{notes.verifiedNotes}</strong>
              <div className="tableSubtle">{notes.pinnedNotes} pinned. <Link href="/app/notes" className="inlineLink">Open notes</Link></div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Coverage</h2>
              <div className="subtle">Signals that matter for an internal CRM.</div>
            </div>
          </div>
          <div className="insightList">
            <div className="insightItem">
              <span className="insightValue">Linked organizations</span>
              <div>{contacts.linkedOrganizations} verified contacts have organization context attached.</div>
            </div>
            <div className="insightItem">
              <span className="insightValue">Reachable contacts</span>
              <div>{contacts.withEmail} verified contacts have an email on file.</div>
            </div>
            <div className="insightItem">
              <span className="insightValue">Recent activity</span>
              <div>{interactions.recentInteractions} verified interactions landed in the last 14 days.</div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-2">
        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Stage breakdown</h2>
              <div className="subtle">Built from verified, active fundraising accounts.</div>
            </div>
          </div>
          <div className="stageList">
            {fundraising.stageCounts.length ? (
              fundraising.stageCounts.map((item) => (
                <div key={item.stage} className="stageItem">
                  <div className="splitRow">
                    <strong>{item.stage}</strong>
                    <span className="badge">{item.count}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="emptyState">
                <div className="emptyStateTitle">No verified fundraising rows yet</div>
                <div className="emptyStateBody">Once the pipeline has credible account data, the stage mix will show up here.</div>
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Latest relationship activity</h2>
              <div className="subtle">Recent verified interactions for the operating team.</div>
            </div>
            <Link href="/app/interactions" className="inlineLink">Open interactions</Link>
          </div>
          <div className="activityList">
            {latestInteractions.length ? (
              latestInteractions.map((row) => (
                <div key={row.id} className="activityItem">
                  <div className="splitRow">
                    <strong>{row.subject ?? row.interaction_type ?? 'Untitled interaction'}</strong>
                    <span className="badge">{formatDateTime(row.occurred_at)}</span>
                  </div>
                  <div className="tableSubtle">{formatInteractionSummary(row)}</div>
                </div>
              ))
            ) : (
              <div className="emptyState">
                <div className="emptyStateTitle">No verified interactions yet</div>
                <div className="emptyStateBody">Interaction history will populate here once usable touchpoints are available.</div>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-2">
        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Investor spotlight</h2>
              <div className="subtle">Top verified fundraising accounts by target commitment.</div>
            </div>
            <Link href="/app/fundraising" className="inlineLink">Open fundraising</Link>
          </div>
          <div className="tableWrap">
            <table className="table tableCompact">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Stage</th>
                  <th>HQ</th>
                  <th>Target</th>
                  <th>Committed</th>
                </tr>
              </thead>
              <tbody>
                {spotlightRows.length ? (
                  spotlightRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.organization ? (
                          <Link href={`/app/organizations/${row.organization.id}`} className="tableTitle">
                            {row.organization.name}
                          </Link>
                        ) : (
                          <div className="tableTitle">Unknown organization</div>
                        )}
                        <div className="tableSubtle">{row.organization?.organization_type ?? 'Organization type unavailable'}</div>
                      </td>
                      <td>{row.stage}</td>
                      <td>{row.organization?.headquarters ?? '—'}</td>
                      <td>{formatUsd(row.target_commitment)}</td>
                      <td>{formatUsd(row.committed_amount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <div className="emptyState">
                        <div className="emptyStateTitle">No verified fundraising rows available</div>
                        <div className="emptyStateBody">The spotlight table will fill once the verified pipeline has active accounts.</div>
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
              <h2 className="sectionTitle">Newest verified contacts</h2>
              <div className="subtle">Fresh relationship records ready for follow-up.</div>
            </div>
            <Link href="/app/contacts" className="inlineLink">Open contacts</Link>
          </div>
          <div className="tableWrap">
            <table className="table tableCompact">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Organization</th>
                  <th>Title</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {latestContacts.length ? (
                  latestContacts.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link href={`/app/contacts/${row.id}`} className="tableTitle">
                          {getContactDisplayName(row)}
                        </Link>
                        <div className="tableSubtle">{row.email ?? row.phone ?? 'No direct contact path yet'}</div>
                      </td>
                      <td>{row.primary_organization?.name ?? '—'}</td>
                      <td>{row.job_title ?? '—'}</td>
                      <td>{formatDateTime(row.created_at)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>
                      <div className="emptyState">
                        <div className="emptyStateTitle">No verified contacts available</div>
                        <div className="emptyStateBody">New contact records will appear here once they pass the default quality filter.</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
