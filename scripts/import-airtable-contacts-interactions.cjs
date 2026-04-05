const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const postgres = require('postgres');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL');
}

const baseDir = '/Users/MA/.openclaw/workspace/projects/SpiceHQ/data/imports/airtable/fundraising_crm_database';
const contactsPath = path.join(baseDir, 'contacts.raw.json');
const interactionsPath = path.join(baseDir, 'interactions.raw.json');

const contactsData = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
const interactionsData = JSON.parse(fs.readFileSync(interactionsPath, 'utf8'));

const sql = postgres(databaseUrl, { ssl: 'require', max: 1 });

function deterministicUuid(input) {
  const hex = crypto.createHash('sha1').update(input).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20, 32).join('')}`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function parseName(fullName) {
  const cleaned = String(fullName || '').trim().replace(/^\[FAKE\]\s*/i, '');
  const pieces = cleaned.split(/\s+/).filter(Boolean);
  if (pieces.length === 0) {
    return { firstName: 'Unknown', lastName: 'Contact', fullName: 'Unknown Contact' };
  }
  if (pieces.length === 1) {
    return { firstName: pieces[0], lastName: '', fullName: cleaned || pieces[0] };
  }
  return {
    firstName: pieces[0],
    lastName: pieces.slice(1).join(' '),
    fullName: cleaned
  };
}

function airtableInvestorOrgUuid(airtableRecordId) {
  return deterministicUuid(`airtable:investors:org:${airtableRecordId}`);
}

function airtableInvestorFundraisingUuid(airtableRecordId) {
  return deterministicUuid(`airtable:investors:fa:${airtableRecordId}`);
}

(async () => {
  const contacts = [];
  const contactOrganizations = [];
  const externalLinks = [];

  for (const record of contactsData) {
    const fields = record.fields || {};
    const name = parseName(fields['Name']);
    const contactId = deterministicUuid(`airtable:contacts:${record.id}`);
    const orgRecordIds = Array.isArray(fields['Investor/Firm']) ? fields['Investor/Firm'] : [];
    const primaryOrgId = orgRecordIds[0] ? airtableInvestorOrgUuid(orgRecordIds[0]) : null;
    const metadata = {
      airtable_base_id: 'appX8dLK2sSUhqa2d',
      airtable_table: 'Contacts',
      airtable_record_id: record.id,
      airtable_created_time: record.createdTime,
      raw_fields: fields
    };

    contacts.push({
      id: contactId,
      owner_id: null,
      primary_organization_id: primaryOrgId,
      first_name: name.firstName,
      last_name: name.lastName,
      full_name: name.fullName,
      job_title: fields['Investor Title'] ? String(fields['Investor Title']) : null,
      email: null,
      phone: null,
      linkedin_url: fields['LinkedIn'] ? String(fields['LinkedIn']) : null,
      preferred_channel: null,
      status: 'active',
      notes: fields['Notes'] ? String(fields['Notes']) : null
    });

    for (const orgRecordId of orgRecordIds) {
      contactOrganizations.push({
        contact_id: contactId,
        organization_id: airtableInvestorOrgUuid(orgRecordId),
        relationship_type: 'investor_contact',
        is_primary: orgRecordId === orgRecordIds[0],
        title: fields['Investor Title'] ? String(fields['Investor Title']) : null
      });
    }

    externalLinks.push({
      id: deterministicUuid(`erl:contact:${record.id}`),
      source_system: 'airtable',
      source_table: 'Contacts',
      external_id: record.id,
      target_table: 'contacts',
      organization_id: null,
      contact_id: contactId,
      fundraising_account_id: null,
      interaction_id: null,
      document_id: null,
      metadata
    });
  }

  const interactions = [];
  const interactionContacts = [];
  const interactionOrganizations = [];
  const interactionFundraisingAccounts = [];

  for (const record of interactionsData) {
    const fields = record.fields || {};
    const interactionId = deterministicUuid(`airtable:interactions:${record.id}`);
    const description = fields['Interaction Description'] ? String(fields['Interaction Description']) : 'Airtable interaction';
    const dateValue = fields['Date'] ? `${fields['Date']}T12:00:00Z` : new Date().toISOString();
    const firms = Array.isArray(fields['Firm']) ? fields['Firm'] : [];
    const firstDegree = Array.isArray(fields['1st Degree Contact']) ? fields['1st Degree Contact'] : [];
    const secondDegree = Array.isArray(fields['2nd Degree Contact']) ? fields['2nd Degree Contact'] : [];
    const allContacts = [...new Set([...firstDegree, ...secondDegree])];
    const metadata = {
      airtable_base_id: 'appX8dLK2sSUhqa2d',
      airtable_table: 'Interactions',
      airtable_record_id: record.id,
      airtable_created_time: record.createdTime,
      raw_fields: fields
    };

    interactions.push({
      id: interactionId,
      created_by: null,
      interaction_type: fields['Interaction Type Detail'] ? String(fields['Interaction Type Detail']) : (fields['Interaction Type'] ? String(fields['Interaction Type']) : 'interaction'),
      direction: null,
      source_system: 'airtable',
      subject: description,
      summary: description,
      body_preview: fields['Interaction Type'] ? String(fields['Interaction Type']) : null,
      transcript_text: null,
      occurred_at: dateValue,
      source_url: null,
      external_thread_id: null,
      external_message_id: null,
      external_event_id: null,
      metadata
    });

    for (const contactRecordId of allContacts) {
      interactionContacts.push({
        interaction_id: interactionId,
        contact_id: deterministicUuid(`airtable:contacts:${contactRecordId}`),
        relationship_role: firstDegree.includes(contactRecordId) ? 'primary_contact' : 'secondary_contact'
      });
    }

    for (const orgRecordId of firms) {
      interactionOrganizations.push({
        interaction_id: interactionId,
        organization_id: airtableInvestorOrgUuid(orgRecordId),
        relationship_role: 'participant'
      });
      interactionFundraisingAccounts.push({
        interaction_id: interactionId,
        fundraising_account_id: airtableInvestorFundraisingUuid(orgRecordId)
      });
    }

    externalLinks.push({
      id: deterministicUuid(`erl:interaction:${record.id}`),
      source_system: 'airtable',
      source_table: 'Interactions',
      external_id: record.id,
      target_table: 'interactions',
      organization_id: null,
      contact_id: null,
      fundraising_account_id: null,
      interaction_id: interactionId,
      document_id: null,
      metadata
    });
  }

  await sql.begin(async (tx) => {
    for (const batch of chunk(contacts, 100)) {
      await tx`
        insert into public.contacts (
          id, owner_id, primary_organization_id, first_name, last_name, full_name,
          job_title, email, phone, linkedin_url, preferred_channel, status, notes
        )
        select * from jsonb_to_recordset(${tx.json(batch)}::jsonb) as x(
          id uuid, owner_id uuid, primary_organization_id uuid, first_name text, last_name text,
          full_name text, job_title text, email text, phone text, linkedin_url text,
          preferred_channel text, status text, notes text
        )
        on conflict (id) do update set
          primary_organization_id = excluded.primary_organization_id,
          first_name = excluded.first_name,
          last_name = excluded.last_name,
          full_name = excluded.full_name,
          job_title = excluded.job_title,
          linkedin_url = excluded.linkedin_url,
          notes = excluded.notes,
          updated_at = now()
      `;
    }

    for (const batch of chunk(contactOrganizations, 150)) {
      await tx`
        insert into public.contact_organizations (
          contact_id, organization_id, relationship_type, is_primary, title
        )
        select * from jsonb_to_recordset(${tx.json(batch)}::jsonb) as x(
          contact_id uuid, organization_id uuid, relationship_type text, is_primary boolean, title text
        )
        on conflict (contact_id, organization_id) do update set
          relationship_type = excluded.relationship_type,
          is_primary = excluded.is_primary,
          title = excluded.title
      `;
    }

    for (const batch of chunk(interactions, 100)) {
      await tx`
        insert into public.interactions (
          id, created_by, interaction_type, direction, source_system, subject,
          summary, body_preview, transcript_text, occurred_at, source_url,
          external_thread_id, external_message_id, external_event_id, metadata
        )
        select * from jsonb_to_recordset(${tx.json(batch)}::jsonb) as x(
          id uuid, created_by uuid, interaction_type text, direction text, source_system text,
          subject text, summary text, body_preview text, transcript_text text,
          occurred_at timestamptz, source_url text, external_thread_id text,
          external_message_id text, external_event_id text, metadata jsonb
        )
        on conflict (id) do update set
          interaction_type = excluded.interaction_type,
          subject = excluded.subject,
          summary = excluded.summary,
          body_preview = excluded.body_preview,
          occurred_at = excluded.occurred_at,
          metadata = excluded.metadata,
          updated_at = now()
      `;
    }

    for (const batch of chunk(interactionContacts, 150)) {
      await tx`
        insert into public.interaction_contacts (
          interaction_id, contact_id, relationship_role
        )
        select * from jsonb_to_recordset(${tx.json(batch)}::jsonb) as x(
          interaction_id uuid, contact_id uuid, relationship_role text
        )
        on conflict (interaction_id, contact_id) do update set
          relationship_role = excluded.relationship_role
      `;
    }

    for (const batch of chunk(interactionOrganizations, 150)) {
      await tx`
        insert into public.interaction_organizations (
          interaction_id, organization_id, relationship_role
        )
        select * from jsonb_to_recordset(${tx.json(batch)}::jsonb) as x(
          interaction_id uuid, organization_id uuid, relationship_role text
        )
        on conflict (interaction_id, organization_id) do update set
          relationship_role = excluded.relationship_role
      `;
    }

    for (const batch of chunk(interactionFundraisingAccounts, 150)) {
      await tx`
        insert into public.interaction_fundraising_accounts (
          interaction_id, fundraising_account_id
        )
        select distinct interaction_id, fundraising_account_id
        from jsonb_to_recordset(${tx.json(batch)}::jsonb) as x(
          interaction_id uuid, fundraising_account_id uuid
        )
        on conflict (interaction_id, fundraising_account_id) do nothing
      `;
    }

    for (const batch of chunk(externalLinks, 150)) {
      await tx`
        insert into public.external_record_links (
          id, source_system, source_table, external_id, target_table,
          organization_id, contact_id, fundraising_account_id, interaction_id, document_id, metadata
        )
        select * from jsonb_to_recordset(${tx.json(batch)}::jsonb) as x(
          id uuid, source_system text, source_table text, external_id text, target_table text,
          organization_id uuid, contact_id uuid, fundraising_account_id uuid, interaction_id uuid,
          document_id uuid, metadata jsonb
        )
        on conflict (source_system, source_table, external_id, target_table) do update set
          contact_id = excluded.contact_id,
          interaction_id = excluded.interaction_id,
          metadata = excluded.metadata
      `;
    }
  });

  const [contactCount] = await sql`select count(*)::int as count from public.contacts`;
  const [interactionCount] = await sql`select count(*)::int as count from public.interactions`;
  const [contactOrgCount] = await sql`select count(*)::int as count from public.contact_organizations`;
  const [interactionContactCount] = await sql`select count(*)::int as count from public.interaction_contacts`;
  const [interactionOrgCount] = await sql`select count(*)::int as count from public.interaction_organizations`;

  console.log(
    JSON.stringify(
      {
        contacts: contactCount.count,
        interactions: interactionCount.count,
        contactOrganizations: contactOrgCount.count,
        interactionContacts: interactionContactCount.count,
        interactionOrganizations: interactionOrgCount.count
      },
      null,
      2
    )
  );

  await sql.end();
})().catch(async (err) => {
  console.error(err);
  try {
    await sql.end();
  } catch {}
  process.exit(1);
});
