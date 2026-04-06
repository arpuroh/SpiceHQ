import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateOrganizationAction } from '@/app/app/actions';
import { MetricCard, PageHeader } from '@/components/crm-ui';
import { getOrganizationDetailData } from '@/lib/data/organizations';
import { formatUsd } from '@/lib/data/fundraising';
import { formatDateTime } from '@/lib/data/contacts';
import { formatReviewFlags } from '@/lib/data/record-quality';
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
          label="Type"
          value={org.organization_type ?? '—'}
          note={org.headquarters ?? 'No location set'}
        />
      </div>

      <div className="detailGrid">
        <div className="detailMain">
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
                <span>Notes</span>
                <textarea name="notes" rows={6} defaultValue={org.notes ?? ''} placeholder="Firm thesis, sourcing info, relationship context..." />
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
        </div>

        <aside className="detailSidebar">
          {org.fundraising_accounts.length > 0 ? (
            <section className="panel">
              <div className="panelHeader">
                <div className="panelTitleGroup">
                  <h2 className="sectionTitle">Pipeline</h2>
                  <div className="subtle">Fundraising accounts for this org.</div>
                </div>
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
              </div>
              <div className="activityList">
                {org.interactions.slice(0, 10).map((interaction) => (
                  <div key={interaction.id} className="activityItem">
                    <div className="splitRow">
                      <strong>{interaction.subject ?? interaction.interaction_type ?? 'Interaction'}</strong>
                      <span className="badge">{formatDateTime(interaction.occurred_at)}</span>
                    </div>
                    {interaction.summary ? (
                      <div className="tableSubtle">
                        {interaction.summary.length > 120 ? interaction.summary.slice(0, 120) + '...' : interaction.summary}
                      </div>
                    ) : null}
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
              {org.website ? (
                <div className="activityItem">
                  <strong>Website</strong>
                  <div className="tableSubtle">{org.website}</div>
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
