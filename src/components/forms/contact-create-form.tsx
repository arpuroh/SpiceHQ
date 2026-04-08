import Link from 'next/link';
import { addContactAction } from '@/app/app/actions';
import type { ContactOrganization } from '@/lib/data/contacts';

export function ContactCreateForm({ organizationOptions }: { organizationOptions: ContactOrganization[] }) {
  return (
    <form action={addContactAction} className="stack">

      <div className="formGrid formGrid2">
        <label className="field">
          <span>First name</span>
          <input name="first_name" required />
        </label>
        <label className="field">
          <span>Last name</span>
          <input name="last_name" required />
        </label>
      </div>

      <div className="formGrid formGrid2">
        <label className="field">
          <span>Title</span>
          <input name="job_title" placeholder="Partner" />
        </label>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" placeholder="name@firm.com" />
        </label>
      </div>

      <div className="formGrid formGrid2">
        <label className="field">
          <span>Phone</span>
          <input name="phone" type="tel" placeholder="+1 212 555 0198" />
        </label>
        <label className="field">
          <span>Preferred channel</span>
          <input name="preferred_channel" placeholder="Email" />
        </label>
      </div>

      <label className="field">
        <span>Organization</span>
        <select name="organization_id" defaultValue="">
          <option value="">No organization yet</option>
          {organizationOptions.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>LinkedIn URL</span>
        <input
          name="linkedin_url"
          type="url"
          placeholder="https://linkedin.com/in/..."
        />
      </label>

      <label className="field">
        <span>Notes</span>
        <textarea name="notes" rows={4} placeholder="Relationship context, last conversation, what matters next." />
      </label>

      <div className="buttonRow">
        <button type="submit" className="primaryButton">Create person</button>
        <Link href="/app/contacts" className="secondaryButton">
          Reset context
        </Link>
      </div>
    </form>
  );
}
