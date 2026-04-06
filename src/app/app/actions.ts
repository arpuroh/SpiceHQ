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

  const website = getString(formData, 'website');

  if (!name) {
    redirect('/app/organizations?error=' + buildQueryParam('Organization name is required.'));
  }

  const { error } = await admin.from('organizations').insert({
    id: randomUUID(),
    name,
    organization_type: organizationType,
    headquarters,
    website,
    notes
  });

  if (error) {
    redirect('/app/organizations?error=' + buildQueryParam(error.message));
  }

  revalidatePath('/app');
  revalidatePath('/app/contacts');
  revalidatePath('/app/organizations');
  revalidatePath('/app/fundraising');

  redirect('/app/organizations?created=organization');
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

export async function updateContactAction(formData: FormData) {
  await requireAllowedUser();

  const admin = createAdminClient();
  const contactId = getString(formData, 'contact_id');
  const firstName = getString(formData, 'first_name');
  const lastName = getString(formData, 'last_name');
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const organizationId = getString(formData, 'organization_id');
  const jobTitle = getString(formData, 'job_title');
  const email = getString(formData, 'email');
  const linkedinUrl = getString(formData, 'linkedin_url');
  const notes = getString(formData, 'notes');
  const status = getString(formData, 'status');

  if (!contactId) {
    redirect('/app/contacts?error=' + buildQueryParam('Missing contact id.'));
  }

  if (!firstName || !lastName) {
    redirect(`/app/contacts/${contactId}?error=` + buildQueryParam('First and last name are required.'));
  }

  const { error: contactError } = await admin
    .from('contacts')
    .update({
      primary_organization_id: organizationId,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      job_title: jobTitle,
      email,
      linkedin_url: linkedinUrl,
      status,
      notes
    })
    .eq('id', contactId);

  if (contactError) {
    redirect(`/app/contacts/${contactId}?error=` + buildQueryParam(contactError.message));
  }

  const { error: clearPrimaryError } = await admin
    .from('contact_organizations')
    .update({ is_primary: false })
    .eq('contact_id', contactId);

  if (clearPrimaryError) {
    redirect(`/app/contacts/${contactId}?error=` + buildQueryParam(clearPrimaryError.message));
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
      redirect(`/app/contacts/${contactId}?error=` + buildQueryParam(organizationLinkError.message));
    }
  }

  revalidatePath('/app');
  revalidatePath('/app/contacts');
  revalidatePath(`/app/contacts/${contactId}`);
  revalidatePath('/app/interactions');

  redirect(`/app/contacts/${contactId}?saved=1`);
}

export async function updateOrganizationAction(formData: FormData) {
  await requireAllowedUser();

  const admin = createAdminClient();
  const organizationId = getString(formData, 'organization_id');
  const name = getString(formData, 'name');
  const organizationType = getString(formData, 'organization_type');
  const headquarters = getString(formData, 'headquarters');
  const website = getString(formData, 'website');
  const linkedinUrl = getString(formData, 'linkedin_url');
  const notes = getString(formData, 'notes');

  if (!organizationId) {
    redirect('/app/organizations?error=' + buildQueryParam('Missing organization id.'));
  }

  if (!name) {
    redirect(`/app/organizations/${organizationId}?error=` + buildQueryParam('Organization name is required.'));
  }

  const { error } = await admin
    .from('organizations')
    .update({
      name,
      organization_type: organizationType,
      headquarters,
      website,
      linkedin_url: linkedinUrl,
      notes,
      updated_at: new Date().toISOString()
    })
    .eq('id', organizationId);

  if (error) {
    redirect(`/app/organizations/${organizationId}?error=` + buildQueryParam(error.message));
  }

  revalidatePath('/app');
  revalidatePath('/app/organizations');
  revalidatePath(`/app/organizations/${organizationId}`);
  revalidatePath('/app/contacts');
  revalidatePath('/app/fundraising');

  redirect(`/app/organizations/${organizationId}?saved=1`);
}

export async function addInteractionAction(formData: FormData) {
  await requireAllowedUser();

  const admin = createAdminClient();
  const interactionType = getString(formData, 'interaction_type');
  const sourceSystem = getString(formData, 'source_system') ?? 'manual';
  const subject = getString(formData, 'subject');
  const summary = getString(formData, 'summary');
  const occurredAt = getString(formData, 'occurred_at') ?? new Date().toISOString();
  const interactionId = randomUUID();

  if (!subject && !summary) {
    redirect('/app/interactions?error=' + buildQueryParam('At least a subject or summary is required.'));
  }

  const { error: interactionError } = await admin.from('interactions').insert({
    id: interactionId,
    interaction_type: interactionType ?? 'note',
    source_system: sourceSystem,
    subject,
    summary,
    body_preview: summary ? summary.slice(0, 200) : null,
    occurred_at: occurredAt
  });

  if (interactionError) {
    redirect('/app/interactions?error=' + buildQueryParam(interactionError.message));
  }

  revalidatePath('/app');
  revalidatePath('/app/interactions');

  redirect('/app/interactions?created=interaction');
}

export async function updateFundraisingStageAction(formData: FormData) {
  await requireAllowedUser();

  const admin = createAdminClient();
  const accountId = getString(formData, 'account_id');
  const stage = getString(formData, 'stage');
  const status = getString(formData, 'status');
  const relationshipTemperature = getString(formData, 'relationship_temperature');
  const memo = getString(formData, 'memo');

  if (!accountId) {
    redirect('/app/fundraising?error=' + buildQueryParam('Missing account id.'));
  }

  const updates: Record<string, unknown> = {};
  if (stage !== null) updates.stage = stage;
  if (status !== null) updates.status = status;
  if (relationshipTemperature !== null) updates.relationship_temperature = relationshipTemperature;
  if (memo !== null) updates.memo = memo;

  if (Object.keys(updates).length === 0) {
    redirect('/app/fundraising');
  }

  const { error } = await admin
    .from('fundraising_accounts')
    .update(updates)
    .eq('id', accountId);

  if (error) {
    redirect('/app/fundraising?error=' + buildQueryParam(error.message));
  }

  revalidatePath('/app');
  revalidatePath('/app/fundraising');

  redirect('/app/fundraising?saved=1');
}
