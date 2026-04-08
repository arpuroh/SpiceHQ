import Link from 'next/link';
import { updateContactAction } from '@/app/app/actions';
import type { ContactOrganization, ContactRow } from '@/lib/data/contacts';

const defaultStatusOptions = ['active', 'prospect', 'warm', 'inactive'];

export function ContactEditForm({
  contact,
  organizationOptions
}: {
  contact: ContactRow;
  organizationOptions: ContactOrganization[];
}) {
  const availableStatuses = contact.status && !defaultStatusOptions.includes(contact.status)
    ? [contact.status, ...defaultStatusOptions]
    : defaultStatusOptions;

  return (
    <form action={updateContactAction} className="stack">
      <input type="hidden" name="contact_id" value={contact.id} />

      <div className="formGrid formGrid2">
        <label className="field">
          <span>First name</span>
          <input
            name="first_name"
            required
            defaultValue={contact.first_name}
          />
        </label>
        <label className="field">
          <span>Last name</span>
          <input
            name="last_name"
            required
            defaultValue={contact.last_name ?? ''}
          />
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
          <input
            name="email"
            type="email"
            defaultValue={contact.email ?? ''}
          />
        </label>
        <label className="field">
          <span>Phone</span>
          <input name="phone" type="tel" defaultValue={contact.phone ?? ''} />
        </label>
      </div>

      <div className="formGrid formGrid2">
        <label className="field">
          <span>Preferred channel</span>
          <input name="preferred_channel" defaultValue={contact.preferred_channel ?? ''} />
        </label>
        <label className="field">
          <span>LinkedIn URL</span>
          <input
            name="linkedin_url"
            type="url"
            defaultValue={contact.linkedin_url ?? ''}
          />
        </label>
      </div>

      <label className="field">
        <span>Primary organization</span>
        <select name="organization_id" defaultValue={contact.primary_organization?.id ?? ''}>
          <option value="">No primary organization</option>
          {organizationOptions.map((organization) => (
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
        <button type="submit" className="primaryButton">Save contact</button>
        <Link href="/app/contacts" className="secondaryButton">
          Back to contacts
        </Link>
      </div>
    </form>
  );
}
