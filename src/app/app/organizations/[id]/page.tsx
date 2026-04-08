import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateOrganizationAction } from '@/app/app/actions';
import { MetricCard, PageHeader } from '@/components/crm-ui';
import { getOrganizationDetailData } from '@/lib/data/organizations';
import { formatUsd } from '@/lib/data/fundraising';
import { formatDateTime } from '@/lib/data/contacts';
import { explainReviewFlag, formatReviewFlags } from '@/lib/data/record-quality';
import { createClient } from '@/lib/supabase/server';

type OrganizationDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function OrganizationDetailPage({ params, searchParams }: OrganizationDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const saved = getParam(resolvedSearchParams.saved);
  const error = getParam(resolvedSearchParams.error);
  const supabase = await createClient();
  const data = await getOrganizationDetailData(supabase, id);

  if (!data.row) {
    notFound();
  }

  const org = data.row;

  return (
    <div className="pageStack">
      <PageHeader
        eyebrow="Organization"
        title={org.name}
        description={
          <>
            {org.organization_type ?? 'Organization'}{org.headquarters ? ` based in ${org.headquarters}` : ''}.
            {org.contact_count > 0 ? ` ${org.contact_count} linked contacts.` : ''}
            {org.fundraising_count > 0 ? ` ${org.fundraising_count} pipeline accounts.` : ''}
          </>
        }
        meta={
          <>
            <div className={`statusBadge ${org.quality === 'review' ? 'statusBadge-amber' : 'statusBadge-green'}`}>
              {org.quality === 'review' ? 'Review record' : 'Verified record'}
            </div>
          </>
        }
        actions={[
          {
            href: org.quality === 'review' ? '/app/organizations?view=review' : '/app/organizations',
            label: 'Back to organizations',
            variant: 'secondary'
          }
        ]}
      />

      {saved ? <div className="successBanner">Organization updated.</div> : null}
      {error ? <div className="errorBanner">{error}</div> : null}
      {org.quality === 'review' ? (
        <div className="reviewBanner">
          This organization is flagged for review: {formatReviewFlags(org.review_flags).join(' · ')}.
        </div>
      ) : null}

      <div className="grid grid-4">
        <MetricCard label="Contacts" value={org.contact_count} note="People linked to this org" tone="accent" />
        <MetricCard label="Pipeline accounts" value={org.fundraising_count} note="Fundraising rows for this org" />
        <MetricCard label="Interactions" value={org.interactions.length} note="Logged touchpoints" tone="success" />
        <MetricCard
          label="Open work"
          value={org.tasks.filter((task) => task.status !== 'completed' && task.status !== 'cancelled').length}
          note={`${org.notes.length} notes · ${org.portfolio_companies.length} portfolio link${org.portfolio_companies.length === 1 ? '' : 's'}`}
        />
      </div>

      <div className="detailGrid">
        <div className="detailMain">
          <section className="panel">
            <div className="panelHeader">
              <div className="panelTitleGroup">
                <h2 className="sectionTitle">Organization workspace</h2>
                <div className="subtle">Jump straight into every linked workflow for this firm.</div>
              </div>
            </div>

            <div className="chipStack">
              <div className="relationChip">
                <Link href={`/app/fundraising?organization=${org.id}`} className="tableTitle">Pipeline workspace</Link>
                <span>{org.fundraising_count} linked fundraising account{org.fundraising_count === 1 ? '' : 's'}</span>
              </div>
              <div className="relationChip">
                <Link href={`/app/contacts?organization=${org.id}`} className="tableTitle">Contacts workspace</Link>
                <span>{org.contact_count} linked contact{org.contact_count === 1 ? '' : 's'}</span>
              </div>
              <div className="relationChip">
                <Link href={`/app/interactions?organization=${org.id}`} className="tableTitle">Interaction history</Link>
                <span>{org.interactions.length} touchpoint{org.interactions.length === 1 ? '' : 's'} on record</span>
              </div>
              <div className="relationChip">
                <Link href={`/app/tasks?organization=${org.id}`} className="tableTitle">Task queue</Link>
                <span>{org.tasks.length} task{org.tasks.length === 1 ? '' : 's'} linked to this org</span>
              </div>
              <div className="relationChip">
                <Link href={`/app/notes?organization=${org.id}`} className="tableTitle">Notes and memos</Link>
                <span>{org.notes.length} note{org.notes.length === 1 ? '' : 's'} linked here</span>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div className="panelTitleGroup">
                <h2 className="sectionTitle">Edit organization</h2>
                <div className="subtle">Update firm details and relationship context.</div>
              </div>
            </div>

            <form action={updateOrganizationAction} className="stack">
              <input type="hidden" name="organization_id" value={org.id} />

              <label className="field">
                <span>Name</span>
                <input name="name" required defaultValue={org.name} />
              </label>

              <div className="formGrid formGrid2">
                <label className="field">
                  <span>Type</span>
                  <input name="organization_type" defaultValue={org.organization_type ?? ''} placeholder="Venture Capital, Family Office, ..." />
                </label>
                <label className="field">
                  <span>Headquarters</span>
                  <input name="headquarters" defaultValue={org.headquarters ?? ''} placeholder="New York, NY" />
                </label>
              </div>

              <div className="formGrid formGrid2">
                <label className="field">
                  <span>Website</span>
                  <input name="website" type="url" defaultValue={org.website ?? ''} placeholder="https://..." />
                </label>
                <label className="field">
                  <span>LinkedIn</span>
                  <input name="linkedin_url" type="url" defaultValue={org.linkedin_url ?? ''} placeholder="https://linkedin.com/company/..." />
                </label>
              </div>

              <label className="field">
                <span>Preferred channel</span>
                <input name="preferred_channel" defaultValue={org.preferred_channel ?? ''} placeholder="Email, warm intro, WhatsApp, etc." />
              </label>

              <label className="field">
                <span>Relationship status</span>
                <input name="relationship_status" defaultValue={org.relationship_status ?? ''} placeholder="Warm, active, monitor, intro path, etc." disabled />
              </label>

              <label className="field">
                <span>Description</span>
                <textarea name="description" rows={6} defaultValue={org.description ?? ''} placeholder="Firm thesis, sourcing info, relationship context..." />
              </label>

              <div className="buttonRow">
                <button type="submit" className="primaryButton">Save organization</button>
                <Link href={org.quality === 'review' ? '/app/organizations?view=review' : '/app/organizations'} className="secondaryButton">
                  Cancel
                </Link>
              </div>
            </form>
          </section>

          {org.contacts.length > 0 ? (
            <section className="panel">
              <div className="panelHeader">
                <div className="panelTitleGroup">
                  <h2 className="sectionTitle">Linked contacts</h2>
                  <div className="subtle">{org.contacts.length} people connected to this organization.</div>
                </div>
                <Link href={`/app/contacts?organization=${org.id}`} className="secondaryButton">View in contacts</Link>
              </div>
              <div className="tableWrap">
                <table className="table tableCompact">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Title</th>
                      <th>Email</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {org.contacts.map((contact) => (
                      <tr key={contact.id}>
                        <td>
                          <Link href={`/app/contacts/${contact.id}`} className="tableTitle">
                            {contact.full_name ?? `${contact.first_name} ${contact.last_name ?? ''}`.trim()}
                          </Link>
                        </td>
                        <td>{contact.job_title ?? '—'}</td>
                        <td>{contact.email ?? '—'}</td>
                        <td>{contact.status ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {org.tasks.length > 0 ? (
            <section className="panel">
              <div className="panelHeader">
                <div className="panelTitleGroup">
                  <h2 className="sectionTitle">Linked tasks</h2>
                  <div className="subtle">Action items tied directly to this organization.</div>
                </div>
                <Link href={`/app/tasks?organization=${org.id}`} className="secondaryButton">Open task queue</Link>
              </div>
              <div className="activityList">
                {org.tasks.map((task) => (
                  <div key={task.id} className="activityItem">
                    <div className="splitRow">
                      <strong>{task.title}</strong>
                      <span className="badge">{task.status ?? 'open'}</span>
                    </div>
                    <div className="tableSubtle">
                      {[task.priority, task.due_at ? `Due ${formatDateTime(task.due_at)}` : null].filter(Boolean).join(' · ') || 'No due date'}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="detailSidebar">
          {org.fundraising_accounts.length > 0 ? (
            <section className="panel">
              <div className="panelHeader">
                <div className="panelTitleGroup">
                  <h2 className="sectionTitle">Pipeline</h2>
                  <div className="subtle">Fundraising accounts for this org.</div>
                </div>
                <Link href={`/app/fundraising?q=${encodeURIComponent(org.name)}`} className="secondaryButton">Open fundraising</Link>
              </div>
              <div className="activityList">
                {org.fundraising_accounts.map((account) => (
                  <div key={account.id} className="activityItem">
                    <div className="splitRow">
                      <strong>{account.stage}</strong>
                      <span className="badge">{account.status}</span>
                    </div>
                    <div className="tableSubtle">
                      Target: {formatUsd(account.target_commitment)} · Committed: {formatUsd(account.committed_amount)}
                      {account.relationship_temperature ? ` · ${account.relationship_temperature}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {org.interactions.length > 0 ? (
            <section className="panel">
              <div className="panelHeader">
                <div className="panelTitleGroup">
                  <h2 className="sectionTitle">Recent interactions</h2>
                  <div className="subtle">Latest touchpoints with this org.</div>
                </div>
                <Link href={`/app/interactions?organization=${org.id}`} className="secondaryButton">Open interactions</Link>
              </div>
              <div className="activityList">
                {org.interactions.slice(0, 10).map((interaction) => (
                  <div key={interaction.id} className="activityItem">
                    <div className="splitRow">
                      <strong>{interaction.subject ?? interaction.interaction_type ?? 'Interaction'}</strong>
                      <span className="badge">{formatDateTime(interaction.occurred_at)}</span>
                    </div>
                    <div className="tableSubtle">
                      {[interaction.source_system, interaction.summary ? (interaction.summary.length > 120 ? interaction.summary.slice(0, 120) + '...' : interaction.summary) : null].filter(Boolean).join(' · ') || 'No summary'}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {org.notes.length > 0 ? (
            <section className="panel">
              <div className="panelHeader">
                <div className="panelTitleGroup">
                  <h2 className="sectionTitle">Notes & memos</h2>
                  <div className="subtle">Recent notes linked to this organization.</div>
                </div>
                <Link href={`/app/notes?organization=${org.id}`} className="secondaryButton">Open notes</Link>
              </div>
              <div className="activityList">
                {org.notes.slice(0, 8).map((note) => (
                  <div key={note.id} className="activityItem">
                    <div className="splitRow">
                      <strong>{note.title ?? 'Untitled note'}</strong>
                      <span className="badge">{formatDateTime(note.created_at)}</span>
                    </div>
                    <div className="tableSubtle">
                      {[note.note_type, note.pinned ? 'Pinned' : null].filter(Boolean).join(' · ') || 'General note'}
                    </div>
                    {note.body ? <div className="tableSubtle">{note.body.length > 120 ? note.body.slice(0, 120) + '...' : note.body}</div> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {org.portfolio_companies.length > 0 ? (
            <section className="panel">
              <div className="panelHeader">
                <div className="panelTitleGroup">
                  <h2 className="sectionTitle">Portfolio links</h2>
                  <div className="subtle">Portfolio companies mapped to this organization.</div>
                </div>
              </div>
              <div className="activityList">
                {org.portfolio_companies.map((company) => (
                  <div key={company.id} className="activityItem">
                    <div className="splitRow">
                      <Link href={`/app/portfolio/${company.id}`} className="tableTitle">{company.company_name}</Link>
                      <span className="badge">{company.status ?? company.stage ?? 'portfolio'}</span>
                    </div>
                    <div className="tableSubtle">
                      Stage: {company.stage ?? '—'} · Invested: {formatUsd(company.investment_amount)} · Value: {formatUsd(company.current_valuation)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="panel">
            <div className="panelHeader">
              <div className="panelTitleGroup">
                <h2 className="sectionTitle">Quality notes</h2>
                <div className="subtle">Record assessment status.</div>
              </div>
            </div>
            <div className="activityList">
              <div className="activityItem">
                <strong>Quality</strong>
                <div className="tableSubtle">{org.quality === 'review' ? 'Held in review queue.' : 'Visible in working directory.'}</div>
              </div>
              <div className="activityItem">
                <strong>Flags</strong>
                <div className="tableSubtle">{formatReviewFlags(org.review_flags).join(' · ') || 'No flags detected.'}</div>
              </div>
              {org.review_flags.map((flag) => (
                <div key={flag} className="activityItem">
                  <strong>{formatReviewFlags([flag])[0]}</strong>
                  <div className="tableSubtle">{explainReviewFlag(flag)}</div>
                </div>
              ))}
              {org.website ? (
                <div className="activityItem">
                  <strong>Website</strong>
                  <div className="tableSubtle">{org.website}</div>
                </div>
              ) : null}
              {org.preferred_channel ? (
                <div className="activityItem">
                  <strong>Preferred channel</strong>
                  <div className="tableSubtle">{org.preferred_channel}</div>
                </div>
              ) : null}
              {org.relationship_status ? (
                <div className="activityItem">
                  <strong>Relationship status</strong>
                  <div className="tableSubtle">{org.relationship_status}</div>
                </div>
              ) : null}
              {org.linkedin_url ? (
                <div className="activityItem">
                  <strong>LinkedIn</strong>
                  <div className="tableSubtle">{org.linkedin_url}</div>
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
