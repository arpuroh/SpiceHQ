import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateContactAction } from '@/app/app/actions';
import { MetricCard, PageHeader } from '@/components/crm-ui';
import { getContactDetailData, getContactDisplayName } from '@/lib/data/contacts';
import { formatReviewFlags } from '@/lib/data/record-quality';
import { createClient } from '@/lib/supabase/server';

type ContactDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

const statusOptions = ['active', 'prospect', 'warm', 'inactive'];

export default async function ContactDetailPage({ params, searchParams }: ContactDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const saved = getParam(resolvedSearchParams.saved);
  const error = getParam(resolvedSearchParams.error);
  const supabase = await createClient();
  const data = await getContactDetailData(supabase, id);

  if (!data.row) {
    notFound();
  }

  const contact = data.row;
  const displayName = getContactDisplayName(contact);
  const availableStatuses = contact.status && !statusOptions.includes(contact.status)
    ? [contact.status, ...statusOptions]
    : statusOptions;

  return (
    <div className="pageStack">
      <PageHeader
        eyebrow="Contact"
        title={displayName}
        description={<>Edit the core CRM fields directly in the Supabase-backed contact record.</>}
        meta={
          <>
            <div className={`statusBadge ${contact.quality === 'review' ? 'statusBadge-amber' : 'statusBadge-green'}`}>
              {contact.quality === 'review' ? 'Review record' : 'Verified record'}
            </div>
            {contact.status ? <div className="badge">Status: {contact.status}</div> : null}
          </>
        }
        actions={[
          {
            href: contact.quality === 'review' ? '/app/contacts?view=review' : '/app/contacts',
            label: 'Back to contacts',
            variant: 'secondary'
          }
        ]}
      />

      {saved ? <div className="successBanner">Contact updated.</div> : null}
      {error ? <div className="errorBanner">{error}</div> : null}
      {contact.quality === 'review' ? (
        <div className="reviewBanner">
          This contact is currently flagged for review: {formatReviewFlags(contact.review_flags).join(' · ')}.
        </div>
      ) : null}

      <div className="grid grid-4">
        <MetricCard label="Primary organization" value={contact.primary_organization?.name ?? '—'} note="Current primary relationship anchor" />
        <MetricCard label="Email" value={contact.email ?? '—'} note="Direct outreach path on file" tone="success" />
        <MetricCard label="LinkedIn" value={contact.linkedin_url ? 'On file' : 'Missing'} note={contact.linkedin_url ?? 'No LinkedIn URL saved'} />
        <MetricCard
          label="Created"
          value={contact.created_at ? new Date(contact.created_at).toLocaleDateString('en-US') : '—'}
          note={contact.created_at ? new Date(contact.created_at).toLocaleTimeString('en-US') : 'Creation time unavailable'}
        />
      </div>

      <div className="detailGrid">
        <section className="panel">
          <div className="panelHeader">
            <div className="panelTitleGroup">
              <h2 className="sectionTitle">Edit contact</h2>
              <div className="subtle">Keep the relationship record clean enough for pipeline and interaction work.</div>
            </div>
          </div>

          <form action={updateContactAction} className="stack">
            <input type="hidden" name="contact_id" value={contact.id} />

            <div className="formGrid formGrid2">
              <label className="field">
                <span>First name</span>
                <input name="first_name" required defaultValue={contact.first_name} />
              </label>
              <label className="field">
                <span>Last name</span>
                <input name="last_name" required defaultValue={contact.last_name ?? ''} />
              </label>
            </div>

            <div className="formGrid formGrid2">
              <label className="field">
                <span>Title</span>
                <input name="job_title" defaultValue={contact.job_title ?? ''} />
              </label>
              <label className="field">
                <span>Status</span>
                <select name="status" defaultValue={contact.status ?? 'active'}>
                  {availableStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="formGrid formGrid2">
              <label className="field">
                <span>Email</span>
                <input name="email" type="email" defaultValue={contact.email ?? ''} />
              </label>
              <label className="field">
                <span>LinkedIn URL</span>
                <input name="linkedin_url" type="url" defaultValue={contact.linkedin_url ?? ''} />
              </label>
            </div>

            <label className="field">
              <span>Primary organization</span>
              <select name="organization_id" defaultValue={contact.primary_organization?.id ?? ''}>
                <option value="">No primary organization</option>
                {data.organizationOptions.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Notes</span>
              <textarea name="notes" rows={8} defaultValue={contact.notes ?? ''} />
            </label>

            <div className="buttonRow">
              <button type="submit" className="primaryButton">
                Save contact
              </button>
              <Link href={contact.quality === 'review' ? '/app/contacts?view=review' : '/app/contacts'} className="secondaryButton">
                Cancel
              </Link>
            </div>
          </form>
        </section>

        <aside className="detailSidebar">
          <section className="panel">
            <div className="panelHeader">
              <div className="panelTitleGroup">
                <h2 className="sectionTitle">Record detail</h2>
                <div className="subtle">Quick read before making edits.</div>
              </div>
            </div>
            <div className="statBlock">
              <div>
                <div className="statLabel">Primary organization</div>
                <div className="statValue">{contact.primary_organization?.name ?? 'No primary organization set'}</div>
              </div>
              <div>
                <div className="statLabel">Preferred channel</div>
                <div className="statValue">{contact.preferred_channel ?? 'Not set'}</div>
              </div>
              <div>
                <div className="statLabel">Related organizations</div>
                <div className="statValue">
                  {contact.organizations.length
                    ? contact.organizations.map((organizationLink) => organizationLink.organization?.name).filter(Boolean).join(' · ')
                    : 'No related organizations linked'}
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div className="panelTitleGroup">
                <h2 className="sectionTitle">Quality notes</h2>
                <div className="subtle">Why this record is or is not in the default CRM path.</div>
              </div>
            </div>
            <div className="activityList">
              <div className="activityItem">
                <strong>Quality status</strong>
                <div className="tableSubtle">{contact.quality === 'review' ? 'Held in the review queue.' : 'Visible in the main CRM.'}</div>
              </div>
              <div className="activityItem">
                <strong>Flags</strong>
                <div className="tableSubtle">{formatReviewFlags(contact.review_flags).join(' · ') || 'No review flags detected.'}</div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
