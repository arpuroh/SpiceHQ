import Link from 'next/link';
import { updateOrganizationAction } from '@/app/app/actions';
import type { ContactOrganization } from '@/lib/data/contacts';

export function OrganizationEditForm({ organization }: { organization: ContactOrganization }) {
  return (
    <form action={updateOrganizationAction} className="stack">
      <input type="hidden" name="organization_id" value={organization.id} />

      <label className="field">
        <span>Name</span>
        <input
          name="name"
          required
          defaultValue={organization.name}
        />
      </label>

      <div className="formGrid formGrid2">
        <label className="field">
          <span>Type</span>
          <input name="organization_type" defaultValue={organization.organization_type ?? ''} />
        </label>
        <label className="field">
          <span>HQ</span>
          <input name="headquarters" defaultValue={organization.headquarters ?? ''} />
        </label>
      </div>

      <div className="formGrid formGrid2">
        <label className="field">
          <span>Website</span>
          <input
            name="website"
            type="url"
            defaultValue={organization.website ?? ''}
          />
        </label>
        <label className="field">
          <span>LinkedIn URL</span>
          <input
            name="linkedin_url"
            type="url"
            defaultValue={organization.linkedin_url ?? ''}
          />
        </label>
      </div>

      <label className="field">
        <span>Preferred channel</span>
        <input name="preferred_channel" defaultValue={organization.preferred_channel ?? ''} />
      </label>

      <label className="field">
        <span>Notes</span>
        <textarea name="notes" rows={8} defaultValue={organization.notes ?? ''} />
      </label>

      <div className="buttonRow">
        <button type="submit" className="primaryButton">Save organization</button>
        <Link href="/app/contacts" className="secondaryButton">
          Back to contacts
        </Link>
      </div>
    </form>
  );
}
