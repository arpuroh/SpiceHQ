import Link from 'next/link';
import { addOrganizationAction } from '@/app/app/actions';

export function OrganizationCreateForm() {
  return (
    <form action={addOrganizationAction} className="stack">

      <label className="field">
        <span>Name</span>
        <input name="name" required placeholder="Acme Capital" />
      </label>

      <div className="formGrid formGrid2">
        <label className="field">
          <span>Type</span>
          <input name="organization_type" placeholder="Fund of funds" defaultValue="Firm" />
        </label>
        <label className="field">
          <span>HQ</span>
          <input name="headquarters" placeholder="New York, NY" />
        </label>
      </div>

      <div className="formGrid formGrid2">
        <label className="field">
          <span>Website</span>
          <input
            name="website"
            type="url"
            placeholder="https://acme.com"
          />
        </label>
        <label className="field">
          <span>LinkedIn URL</span>
          <input
            name="linkedin_url"
            type="url"
            placeholder="https://linkedin.com/company/..."
          />
        </label>
      </div>

      <label className="field">
        <span>Preferred channel</span>
        <input name="preferred_channel" placeholder="Email" />
      </label>

      <label className="field">
        <span>Notes</span>
        <textarea name="notes" rows={6} placeholder="Investment focus, relationship context, internal memory." />
      </label>

      <div className="buttonRow">
        <button type="submit" className="primaryButton">Create organization</button>
        <Link href="/app/contacts" className="secondaryButton">
          Stay on contacts
        </Link>
      </div>
    </form>
  );
}
