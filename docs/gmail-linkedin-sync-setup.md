# Gmail & LinkedIn Sync — Setup Guide

## Overview

SpiceHQ now supports two sync integrations:

1. **Gmail Sync** — Uses Google Apps Script to automatically push email threads to Supabase. Runs every 15 minutes. **Free.**
2. **LinkedIn Enrichment** — Uses Proxycurl API to pull profile data for contacts with LinkedIn URLs. Run on-demand. **~$0.01/profile.**

---

## 1. Database Migration

Before setting up either sync, run the schema migration to create the required tables.

### Option A: Run in Supabase SQL Editor
1. Go to your Supabase project → **SQL Editor**
2. Open and paste the contents of `schema/migrations/002_email_sync_and_enrichment.sql`
3. Click **Run**

### Option B: Run via psql
```bash
psql "$DATABASE_URL" -f schema/migrations/002_email_sync_and_enrichment.sql
```

This creates 5 new tables:
- `email_threads` — Gmail conversation metadata + content
- `email_messages` — Individual messages within threads
- `email_contact_matches` — Links threads ↔ CRM contacts by email
- `sync_state` — Tracks sync progress and errors
- `contact_enrichments` — LinkedIn profile data

**This migration is purely additive. It does NOT modify any existing tables.**

---

## 2. Gmail Sync Setup (Google Apps Script)

### Why Apps Script?
- **$0 cost** — runs on Google's infrastructure for free
- **No tokens to manage** — Apps Script has native Gmail access
- **No server needed** — no cron jobs or background workers on your side
- **One user, perfect fit** — Apps Script quotas are generous (20k email reads/day)

### Step-by-step

#### A. Create the Apps Script project
1. Go to [script.google.com](https://script.google.com)
2. Click **New Project**
3. Name it "SpiceHQ Gmail Sync"
4. Delete the default `myFunction` code
5. Copy the entire contents of `scripts/gmail-sync/gmail-to-supabase.gs` and paste it in

#### B. Set Script Properties
1. Click the **⚙ gear icon** (Project Settings) in the left sidebar
2. Scroll down to **Script Properties**
3. Add these properties:

| Property | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase project URL (e.g., `https://xijwsuntklvkndaldswh.supabase.co`) |
| `SUPABASE_KEY` | Your Supabase **service_role** secret key |
| `MAX_THREADS` | `50` (optional, default is 50) |

#### C. Test the connection
1. In the editor, select `testConnection` from the function dropdown (top bar)
2. Click **Run**
3. Authorize when prompted (Google will ask for Gmail access — this is expected)
4. Check the **Execution log** — you should see "Connection successful!"

#### D. Run the initial sync
1. Select `initialSync` from the function dropdown
2. Click **Run**
3. This pulls the last 30 days of email threads and matches them to your contacts
4. Check the execution log for results

#### E. Set up automatic sync
1. Select `setupTrigger` from the function dropdown and click **Run**
   - OR go to **Triggers** (clock icon in sidebar) → **Add Trigger**:
     - Function: `incrementalSync`
     - Event source: Time-driven
     - Type: Minutes timer
     - Interval: Every 15 minutes

That's it! Gmail threads will now sync to Supabase every 15 minutes.

### Available functions

| Function | Purpose |
|----------|---------|
| `testConnection` | Verify Supabase connectivity |
| `initialSync` | First-time sync (last 30 days) |
| `incrementalSync` | Pulls new threads since last sync (runs on trigger) |
| `rematchContacts` | Re-links all threads to contacts (run after adding new contacts) |
| `setupTrigger` | Creates the 15-minute auto-sync trigger |
| `removeTriggers` | Removes all triggers (for cleanup) |

### Quotas (free tier, per day)

| Resource | Limit | SpiceHQ usage |
|----------|-------|---------------|
| Email reads | 20,000 | ~200-500 |
| URL fetch calls | 20,000 | ~50-200 |
| Script runtime | 90 min total | ~2-5 min |
| Triggers | 20 | 1 |

You'll never come close to these limits with normal use.

---

## 3. LinkedIn Enrichment Setup

### Get a Proxycurl API key
1. Sign up at [nubela.co/proxycurl](https://nubela.co/proxycurl)
2. You get **10 free credits** on signup
3. Additional credits: ~$0.01-0.03 per lookup ($10/month for ~300-1000 lookups)
4. Copy your API key

### Add to environment
Add this to your `.env.local`:
```
PROXYCURL_API_KEY=your_key_here
```

### Run enrichment
```bash
node scripts/linkedin-enrichment/enrich-contacts.cjs
```

The script will:
1. Find all contacts that have a `linkedin_url` set
2. Skip any already enriched
3. Pull profile data from Proxycurl (headline, company, location, photo, experience, education)
4. Save to `contact_enrichments` table
5. Auto-fill empty `job_title` fields on contacts from LinkedIn headlines

### Re-running
The script is idempotent — running it again only enriches new/unenriched contacts. It won't re-fetch profiles already in the database.

### What data is stored

The `contact_enrichments` table stores:
- `headline` — LinkedIn headline (e.g., "Partner at Spice Capital")
- `company` — Current company name
- `location` — City, State, Country
- `photo_url` — Profile photo URL
- `raw_data` — Full JSON with experience history, education, summary

---

## 4. Checking Sync Status

Both syncs write to the `sync_state` table. Query it to check status:

```sql
SELECT sync_type, status, last_sync_at, error_message, metadata
FROM sync_state
ORDER BY last_sync_at DESC;
```

---

## 5. Architecture

```
┌──────────────────┐     ┌───────────────┐     ┌──────────────┐
│  Gmail (Google)   │────▶│  Apps Script   │────▶│   Supabase   │
│                  │     │  (Free, auto)  │     │              │
└──────────────────┘     └───────────────┘     │  email_      │
                                                │  threads     │
┌──────────────────┐     ┌───────────────┐     │  email_      │
│  LinkedIn        │────▶│  Proxycurl    │────▶│  messages    │
│  (Public data)   │     │  ($0.01/req)  │     │  email_      │
└──────────────────┘     └───────────────┘     │  contact_    │
                                                │  matches     │
                                                │  contact_    │
                                                │  enrichments │
                                                └──────────────┘
```

### Data flow
1. **Apps Script** reads Gmail natively (no API keys needed for the logged-in user)
2. Apps Script POSTs to Supabase REST API using the service_role key
3. Contact matching happens automatically by comparing email addresses
4. LinkedIn enrichment runs on-demand via CLI script

### What stays in Google
- The actual email content lives in Gmail — SpiceHQ stores a copy for search/display
- No emails are deleted or modified in Gmail
- Apps Script only reads, never writes to Gmail
