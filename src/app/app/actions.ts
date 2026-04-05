'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAllowedUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildQueryParam(value: string) {
  return encodeURIComponent(value);
}

export async function addOrganizationAction(formData: FormData) {
  await requireAllowedUser();

  const admin = createAdminClient();
  const name = getString(formData, 'name');
  const organizationType = getString(formData, 'organization_type') ?? 'Firm';
  const headquarters = getString(formData, 'headquarters');
  const notes = getString(formData, 'notes');

  if (!name) {
    redirect('/app/contacts?error=' + buildQueryParam('Organization name is required.'));
  }

  const { error } = await admin.from('organizations').insert({
    id: randomUUID(),
    name,
    organization_type: organizationType,
    headquarters,
    notes
  });

  if (error) {
    redirect('/app/contacts?error=' + buildQueryParam(error.message));
  }

  revalidatePath('/app');
  revalidatePath('/app/contacts');
  revalidatePath('/app/fundraising');

  redirect('/app/contacts?created=organization');
}

export async function addContactAction(formData: FormData) {
  await requireAllowedUser();

  const admin = createAdminClient();
  const firstName = getString(formData, 'first_name');
  const lastName = getString(formData, 'last_name');
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const organizationId = getString(formData, 'organization_id');
  const jobTitle = getString(formData, 'job_title');
  const email = getString(formData, 'email');
  const linkedinUrl = getString(formData, 'linkedin_url');
  const notes = getString(formData, 'notes');
  const contactId = randomUUID();

  if (!firstName || !lastName) {
    redirect('/app/contacts?error=' + buildQueryParam('First and last name are required.'));
  }

  const { error: contactError } = await admin.from('contacts').insert({
    id: contactId,
    owner_id: null,
    primary_organization_id: organizationId,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    job_title: jobTitle,
    email,
    phone: null,
    linkedin_url: linkedinUrl,
    preferred_channel: null,
    status: 'active',
    notes
  });

  if (contactError) {
    redirect('/app/contacts?error=' + buildQueryParam(contactError.message));
  }

  if (organizationId) {
    const { error: organizationLinkError } = await admin.from('contact_organizations').upsert(
      {
        contact_id: contactId,
        organization_id: organizationId,
        relationship_type: 'primary',
        is_primary: true,
        title: jobTitle
      },
      {
        onConflict: 'contact_id,organization_id'
      }
    );

    if (organizationLinkError) {
      redirect('/app/contacts?error=' + buildQueryParam(organizationLinkError.message));
    }
  }

  revalidatePath('/app');
  revalidatePath('/app/contacts');
  revalidatePath('/app/interactions');

  redirect('/app/contacts?created=person');
}
