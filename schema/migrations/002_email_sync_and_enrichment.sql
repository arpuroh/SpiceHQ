-- Migration 002: Email sync tables + LinkedIn enrichment
-- Run this AFTER initial_schema.sql is deployed
-- Safe to run multiple times (all CREATE IF NOT EXISTS)

-- ============================================================
-- 1. EMAIL THREADS — one row per Gmail conversation
-- ============================================================
create table if not exists email_threads (
  id text primary key,
  gmail_thread_id text unique not null,
  subject text,
  snippet text,
  last_message_at timestamptz,
  participants jsonb default '[]'::jsonb,
  message_count int default 0,
  labels jsonb default '[]'::jsonb,
  is_read boolean default true,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. EMAIL MESSAGES — individual messages within a thread
-- ============================================================
create table if not exists email_messages (
  id text primary key,
  thread_id text not null references email_threads(id) on delete cascade,
  gmail_message_id text unique not null,
  from_email text,
  from_name text,
  to_emails jsonb default '[]'::jsonb,
  cc_emails jsonb default '[]'::jsonb,
  subject text,
  body_text text,
  body_html text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. EMAIL ↔ CONTACT MATCHES — links threads to CRM contacts
-- ============================================================
create table if not exists email_contact_matches (
  id text primary key,
  thread_id text not null references email_threads(id) on delete cascade,
  contact_id text not null references contacts(id) on delete cascade,
  match_type text not null, -- 'from', 'to', 'cc'
  matched_email text not null,
  created_at timestamptz not null default now(),
  unique (thread_id, contact_id, match_type)
);

-- ============================================================
-- 4. SYNC STATE — tracks incremental sync progress
-- ============================================================
create table if not exists sync_state (
  id text primary key,
  sync_type text unique not null, -- 'gmail', 'linkedin', etc.
  last_sync_at timestamptz,
  last_history_id text, -- Gmail historyId for incremental sync
  cursor text, -- generic cursor for other sync types
  status text not null default 'idle', -- 'idle', 'running', 'error'
  error_message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 5. CONTACT ENRICHMENTS — LinkedIn + other profile data
-- ============================================================
create table if not exists contact_enrichments (
  id text primary key,
  contact_id text not null references contacts(id) on delete cascade,
  source text not null, -- 'linkedin', 'clearbit', etc.
  profile_url text,
  headline text,
  company text,
  location text,
  photo_url text,
  raw_data jsonb default '{}'::jsonb,
  enriched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (contact_id, source)
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_email_threads_gmail_id on email_threads(gmail_thread_id);
create index if not exists idx_email_threads_last_message on email_threads(last_message_at desc);
create index if not exists idx_email_messages_thread on email_messages(thread_id, sent_at desc);
create index if not exists idx_email_messages_from on email_messages(from_email);
create index if not exists idx_email_contact_matches_contact on email_contact_matches(contact_id);
create index if not exists idx_email_contact_matches_thread on email_contact_matches(thread_id);
create index if not exists idx_contact_enrichments_contact on contact_enrichments(contact_id);
create index if not exists idx_sync_state_type on sync_state(sync_type);
