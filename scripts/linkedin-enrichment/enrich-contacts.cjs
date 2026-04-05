/**
 * LinkedIn Contact Enrichment Script
 *
 * Enriches SpiceHQ contacts that have linkedin_url set by pulling
 * public profile data via Proxycurl API.
 *
 * SETUP:
 * 1. Get a Proxycurl API key at https://nubela.co/proxycurl (free tier: 10 credits)
 * 2. Set environment variables (or use .env.local):
 *    - DATABASE_URL or SUPABASE_URL + SUPABASE_KEY
 *    - PROXYCURL_API_KEY
 * 3. Run: node scripts/linkedin-enrichment/enrich-contacts.cjs
 *
 * COST: ~$0.01 per profile lookup. 10 free credits on signup.
 *       For 100 contacts = ~$1-3 total.
 *
 * RATE LIMITS: Proxycurl allows 300 requests/minute on paid plans.
 *              This script adds a 1-second delay between requests to be safe.
 */

const path = require('path');

// Load .env.local if available
try {
  const envPath = path.resolve(__dirname, '../../.env.local');
  const fs = require('fs');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  });
  console.log('Loaded .env.local');
} catch (e) {
  console.log('No .env.local found, using environment variables');
}

// ============================================================
// CONFIG
// ============================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const PROXYCURL_API_KEY = process.env.PROXYCURL_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

if (!PROXYCURL_API_KEY) {
  console.error('Missing PROXYCURL_API_KEY. Get one at https://nubela.co/proxycurl');
  process.exit(1);
}

// ============================================================
// SUPABASE REST HELPERS
// ============================================================

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${response.status}: ${text}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// ============================================================
// PROXYCURL API
// ============================================================

async function lookupLinkedInProfile(linkedinUrl) {
  const apiUrl = `https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(linkedinUrl)}&use_cache=if-present`;

  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${PROXYCURL_API_KEY}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 404) {
      console.log(`  Profile not found: ${linkedinUrl}`);
      return null;
    }
    if (response.status === 429) {
      console.log('  Rate limited, waiting 10 seconds...');
      await sleep(10000);
      return lookupLinkedInProfile(linkedinUrl); // retry once
    }
    throw new Error(`Proxycurl ${response.status}: ${text}`);
  }

  return response.json();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// ENRICHMENT LOGIC
// ============================================================

function normalizeLinkedInUrl(url) {
  if (!url) return null;
  // Ensure it starts with https and doesn't have trailing slashes
  let normalized = url.trim();
  if (!normalized.startsWith('http')) {
    normalized = 'https://' + normalized;
  }
  // Remove trailing slash
  normalized = normalized.replace(/\/+$/, '');
  // Ensure it's a linkedin.com URL
  if (!normalized.includes('linkedin.com')) return null;
  return normalized;
}

async function getContactsToEnrich() {
  // Get contacts that have a linkedin_url but haven't been enriched yet
  const contacts = await supabaseFetch(
    'contacts?linkedin_url=not.is.null&select=id,first_name,last_name,full_name,linkedin_url,email,job_title'
  );

  if (!contacts || contacts.length === 0) {
    console.log('No contacts with LinkedIn URLs found.');
    return [];
  }

  // Check which ones are already enriched
  const enriched = await supabaseFetch(
    'contact_enrichments?source=eq.linkedin&select=contact_id'
  );

  const enrichedIds = new Set((enriched || []).map(e => e.contact_id));

  const toEnrich = contacts.filter(c => !enrichedIds.has(c.id) && normalizeLinkedInUrl(c.linkedin_url));

  console.log(`Found ${contacts.length} contacts with LinkedIn URLs, ${toEnrich.length} need enrichment`);
  return toEnrich;
}

async function enrichContact(contact) {
  const linkedinUrl = normalizeLinkedInUrl(contact.linkedin_url);
  if (!linkedinUrl) {
    console.log(`  Skipping ${contact.full_name || contact.first_name}: invalid LinkedIn URL`);
    return null;
  }

  console.log(`  Enriching: ${contact.full_name || contact.first_name} (${linkedinUrl})`);

  const profile = await lookupLinkedInProfile(linkedinUrl);
  if (!profile) return null;

  // Extract useful fields
  const enrichment = {
    id: crypto.randomUUID(),
    contact_id: contact.id,
    source: 'linkedin',
    profile_url: linkedinUrl,
    headline: profile.headline || null,
    company: profile.experiences?.[0]?.company || null,
    location: [profile.city, profile.state, profile.country_full_name].filter(Boolean).join(', ') || null,
    photo_url: profile.profile_pic_url || null,
    raw_data: JSON.stringify({
      full_name: profile.full_name,
      headline: profile.headline,
      summary: profile.summary,
      country: profile.country_full_name,
      city: profile.city,
      state: profile.state,
      occupation: profile.occupation,
      connections: profile.connections,
      follower_count: profile.follower_count,
      experiences: (profile.experiences || []).slice(0, 5).map(exp => ({
        title: exp.title,
        company: exp.company,
        starts_at: exp.starts_at,
        ends_at: exp.ends_at,
        description: exp.description ? exp.description.substring(0, 300) : null,
      })),
      education: (profile.education || []).slice(0, 3).map(edu => ({
        school: edu.school,
        degree: edu.degree_name,
        field: edu.field_of_study,
        starts_at: edu.starts_at,
        ends_at: edu.ends_at,
      })),
    }),
    enriched_at: new Date().toISOString(),
  };

  // Upsert enrichment
  await supabaseFetch('contact_enrichments', {
    method: 'POST',
    body: JSON.stringify(enrichment),
  });

  // Also update the contact's job_title if we got better data and it's currently empty
  const updates = {};
  if (!contact.job_title && profile.headline) {
    updates.job_title = profile.headline;
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();
    await supabaseFetch(`contacts?id=eq.${contact.id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    console.log(`    Updated contact fields: ${Object.keys(updates).join(', ')}`);
  }

  return enrichment;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('=== LinkedIn Contact Enrichment ===');
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`Proxycurl API key: ${PROXYCURL_API_KEY.substring(0, 8)}...`);
  console.log('');

  // Update sync state
  await supabaseFetch('sync_state', {
    method: 'POST',
    body: JSON.stringify({
      id: 'linkedin-enrichment',
      sync_type: 'linkedin',
      status: 'running',
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });

  try {
    const contacts = await getContactsToEnrich();

    if (contacts.length === 0) {
      console.log('Nothing to enrich. All contacts with LinkedIn URLs have been processed.');
      return;
    }

    // Warn about API credits
    console.log(`\nThis will use approximately ${contacts.length} Proxycurl API credit(s).`);
    console.log('Starting in 3 seconds... (Ctrl+C to cancel)\n');
    await sleep(3000);

    let enriched = 0;
    let failed = 0;

    for (const contact of contacts) {
      try {
        const result = await enrichContact(contact);
        if (result) {
          enriched++;
          console.log(`    ✓ Enriched (${enriched}/${contacts.length})`);
        } else {
          failed++;
        }
      } catch (e) {
        console.error(`    ✗ Failed: ${e.message}`);
        failed++;
      }

      // Rate limiting: 1 second between requests
      await sleep(1000);
    }

    console.log(`\n=== Enrichment Complete ===`);
    console.log(`Enriched: ${enriched}`);
    console.log(`Failed/Skipped: ${failed}`);
    console.log(`Total: ${contacts.length}`);

    // Update sync state
    await supabaseFetch('sync_state', {
      method: 'POST',
      body: JSON.stringify({
        id: 'linkedin-enrichment',
        sync_type: 'linkedin',
        status: 'idle',
        last_sync_at: new Date().toISOString(),
        metadata: JSON.stringify({ enriched, failed, total: contacts.length }),
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error('Enrichment failed:', e.message);
    await supabaseFetch('sync_state', {
      method: 'POST',
      body: JSON.stringify({
        id: 'linkedin-enrichment',
        sync_type: 'linkedin',
        status: 'error',
        error_message: e.message,
        updated_at: new Date().toISOString(),
      }),
    });
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
