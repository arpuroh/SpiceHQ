import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateContactAction } from '@/app/app/actions';
import { getContactDetailData } from '@/lib/data/contacts';
import { createClient } from '@/lib/supabase/server';

type ContactDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getMessageParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const statusOptions = ['active', 'prospect', 'warm', 'inactive'];

export default async function ContactDetailPage({ params, searchParams }: ContactDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const saved = getMessageParam(resolvedSearchParams.saved);
  const error = getMessageParam(resolvedSearchParams.error);
  const supabase = await createClient();
  const data = await getContactDetailData(supabase, id);

  if (!data.row) {
    notFound();
  }

  const contact = data.row;
  const displayName = contact.full_name ?? `${contact.first_name} ${contact.last_name ?? ''}`.trim();
  const availableStatuses = contact.status && !statusOptions.includes(contact.status)
    ? [contact.status, ...statusOptions]
    : statusOptions;

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

      {saved ? <div className="successBanner">Contact updated.</div> : null}
      {error ? <div className="errorBanner">{error}</div> : null}
      {data.curation?.hidden ? (
        <div className="warningBanner">
          Hidden from the default contacts view.
          <div className="tableSubtle" style={{ color: 'inherit' }}>
            {data.curation.reasons.map((reason) => reason.detail).join(' ')}
          </div>
        </div>
      ) : null}

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2 className="sectionTitle" style={{ marginBottom: 6 }}>Edit contact</h2>
            <div className="subtle">
              Created {contact.created_at ? new Date(contact.created_at).toLocaleString('en-US') : 'unknown'}
            </div>
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
            <Link href="/app/contacts" className="secondaryButton">
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
