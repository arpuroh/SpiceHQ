-- Spice HQ V2 starter schema

create table if not exists users (
  id text primary key,
  full_name text not null,
  email text unique not null,
  role text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists funds (
  id text primary key,
  name text not null,
  vehicle_type text,
  vintage_year int,
  target_size numeric,
  soft_circled_total numeric,
  committed_total numeric,
  wired_total numeric,
  status text,
  close_date_target date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organizations (
  id text primary key,
  name text not null,
  category text not null,
  website text,
  linkedin_url text,
  x_url text,
  headquarters text,
  sector_focus text,
  preferred_channel text,
  gmail_thread_url text,
  google_calendar_url text,
  google_drive_url text,
  google_doc_url text,
  last_touch_at timestamptz,
  next_touch_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contacts (
  id text primary key,
  organization_id text references organizations(id) on delete set null,
  company_id text,
  first_name text not null,
  last_name text not null,
  title text,
  role_type text,
  email text,
  phone text,
  linkedin_url text,
  x_url text,
  preferred_channel text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fundraising_pipeline (
  id text primary key,
  fund_id text not null references funds(id) on delete cascade,
  organization_id text not null references organizations(id) on delete cascade,
  primary_contact_id text references contacts(id) on delete set null,
  stage text not null,
  probability_score numeric,
  target_commitment numeric,
  soft_circle_amount numeric,
  committed_amount numeric,
  wired_amount numeric,
  sector_interest text,
  last_touch_at timestamptz,
  next_touch_at timestamptz,
  best_next_action text,
  summary text,
  objections text,
  source text,
  raw_airtable_record_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portfolio_companies (
  id text primary key,
  name text not null,
  stage text,
  sector text,
  headquarters text,
  check_size numeric,
  ownership_pct numeric,
  valuation_entry numeric,
  website text,
  linkedin_url text,
  x_url text,
  preferred_channel text,
  gmail_thread_url text,
  google_calendar_url text,
  google_drive_url text,
  google_doc_url text,
  google_sheet_url text,
  last_touch_at timestamptz,
  next_touch_at timestamptz,
  best_next_action text,
  health text,
  summary text,
  raw_airtable_record_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portfolio_founders (
  company_id text not null references portfolio_companies(id) on delete cascade,
  contact_id text not null references contacts(id) on delete cascade,
  primary key (company_id, contact_id)
);

create table if not exists tasks (
  id text primary key,
  subject_type text not null,
  subject_id text not null,
  title text not null,
  description text,
  status text not null default 'open',
  priority text,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists activities (
  id text primary key,
  subject_type text not null,
  subject_id text not null,
  occurred_at timestamptz not null,
  interaction_type text not null,
  channel text,
  title text,
  summary text,
  source_label text,
  source_url text,
  created_at timestamptz not null default now()
);

create table if not exists google_links (
  id text primary key,
  subject_type text not null,
  subject_id text not null,
  system text not null,
  label text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_fundraising_pipeline_stage on fundraising_pipeline(stage);
create index if not exists idx_fundraising_pipeline_fund on fundraising_pipeline(fund_id);
create index if not exists idx_tasks_subject on tasks(subject_type, subject_id, due_at);
create index if not exists idx_activities_subject on activities(subject_type, subject_id, occurred_at desc);
create index if not exists idx_google_links_subject on google_links(subject_type, subject_id);
