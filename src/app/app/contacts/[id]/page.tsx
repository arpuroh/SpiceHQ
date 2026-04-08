import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContactEditForm } from '@/components/forms/contact-edit-form';
import { formatDateTime, getContactDetailData } from '@/lib/data/contacts';
import { createClient } from '@/lib/supabase/server';

type ContactDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getMessageParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ContactDetailPage({ params, searchParams }: ContactDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const created = getMessageParam(resolvedSearchParams.created);
  const saved = getMessageParam(resolvedSearchParams.saved);
  const error = getMessageParam(resolvedSearchParams.error);
  const supabase = await createClient();
  const data = await getContactDetailData(supabase, id);

  if (!data.row) {
    notFound();
  }

  const contact = data.row;
  const displayName = contact.full_name ?? `${contact.first_name} ${contact.last_name ?? ''}`.trim();

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <div className="badge">Contact</div>
          <h1 style={{ margin: '12px 0 8px', fontSize: 36 }}>{displayName}</h1>
          <div className="subtle">
            Edit the core CRM fields directly in Supabase-backed data.
          </div>
        </div>
        <Link href="/app/contacts" className="secondaryButton">
          Back to contacts
        </Link>
      </div>

      {created ? <div className="successBanner">Person added and ready for more editing.</div> : null}
      {saved ? <div className="successBanner">Contact updated.</div> : null}
      {error ? <div className="errorBanner">{error}</div> : null}

      <div className="grid gridDetail">
        <section className="panel">
          <div className="panelHeader">
            <div>
              <h2 className="sectionTitle" style={{ marginBottom: 6 }}>Edit contact</h2>
              <div className="subtle">Created {formatDateTime(contact.created_at)}</div>
            </div>
          </div>

          <ContactEditForm contact={contact} organizationOptions={data.organizationOptions} />
        </section>

        <aside className="stack">
          <section className="panel">
            <h2 className="sectionTitle">Relationship workspace</h2>
            <div className="chipStack">
              {contact.primary_organization ? (
                <Link href={`/app/organizations/${contact.primary_organization.id}`} className="relationChip">
                  <strong>Primary organization</strong>
                  <span>{contact.primary_organization.name}</span>
                </Link>
              ) : null}

              <Link href={`/app/contacts?${contact.primary_organization ? `organization=${contact.primary_organization.id}` : `q=${encodeURIComponent(displayName)}`}`} className="relationChip">
                <strong>Related contacts</strong>
                <span>{contact.primary_organization ? 'See the rest of the team at this org.' : 'Return to the broader people view.'}</span>
              </Link>

              {contact.primary_organization ? (
                <Link href={`/app/fundraising?organization=${contact.primary_organization.id}`} className="relationChip">
                  <strong>Fundraising context</strong>
                  <span>Jump into the pipeline tied to this organization.</span>
                </Link>
              ) : null}

              {contact.primary_organization ? (
                <Link href={`/app/interactions?organization=${contact.primary_organization.id}`} className="relationChip">
                  <strong>Interaction history</strong>
                  <span>Open touchpoints connected to this relationship.</span>
                </Link>
              ) : null}

              {contact.primary_organization ? (
                <Link href={`/app/tasks?organization=${contact.primary_organization.id}`} className="relationChip">
                  <strong>Follow-up queue</strong>
                  <span>See active tasks around this organization.</span>
                </Link>
              ) : null}
            </div>
          </section>

          <section className="panel">
            <h2 className="sectionTitle">Snapshot</h2>
            <div className="detailList">
              <div className="detailRow"><span>Status</span><strong>{contact.status ?? '—'}</strong></div>
              <div className="detailRow"><span>Email</span><strong>{contact.email ?? '—'}</strong></div>
              <div className="detailRow"><span>Phone</span><strong>{contact.phone ?? '—'}</strong></div>
              <div className="detailRow"><span>Preferred channel</span><strong>{contact.preferred_channel ?? '—'}</strong></div>
            </div>
            {contact.linkedin_url ? (
              <div style={{ marginTop: 16 }}>
                <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="secondaryButton">
                  Open LinkedIn
                </a>
              </div>
            ) : null}
          </section>

          <section className="panel">
            <h2 className="sectionTitle">Organizations</h2>
            {contact.organizations.length ? (
              <div className="chipStack">
                {contact.organizations.map((organizationLink) => {
                  const organization = organizationLink.organization;
                  if (!organization) return null;

                  return (
                    <Link key={organization.id} href={`/app/organizations/${organization.id}`} className="relationChip">
                      <strong>{organization.name}</strong>
                      <span>{organizationLink.is_primary ? 'Primary relationship' : organizationLink.relationship_type ?? 'Related'}</span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="subtle">No organization links yet.</div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
