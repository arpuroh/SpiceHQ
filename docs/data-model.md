# Spice HQ V2 Data Model

V2 is the foundation for a real internal operating system, not just a fundraising list. The model should support three linked workflows:

- fundraising pipeline
- relationship memory
- portfolio support

Google is the backbone first. LinkedIn is prominent. X and WhatsApp remain expansion-ready.

## Core Entities

### users

Keep this simple for now.

- `id`
- `full_name`
- `email`
- `role`
- `is_active`

For the real deployment, this can still be one internal owner without pretending Spice is a multi-layer enterprise org chart.

### funds

- `id`
- `name`
- `vehicle_type`
- `vintage_year`
- `target_size`
- `soft_circled_total`
- `committed_total`
- `wired_total`
- `status`
- `close_date_target`

### organizations

This is the relationship memory layer for LPs, institutions, advisors, and similar counterparties.

- `id`
- `name`
- `category`
- `website`
- `linkedin_url`
- `x_url`
- `headquarters`
- `sector_focus`
- `preferred_channel`
- `gmail_thread_url`
- `google_calendar_url`
- `google_drive_url`
- `google_doc_url`
- `last_touch_at`
- `next_touch_at`
- `notes`

### contacts

People sit alongside organizations and portfolio companies.

- `id`
- `organization_id` nullable
- `company_id` nullable
- `first_name`
- `last_name`
- `title`
- `role_type`
- `email`
- `phone`
- `linkedin_url`
- `x_url`
- `preferred_channel`
- `notes`

### fundraising_pipeline

One row per organization x fund.

- `id`
- `fund_id`
- `organization_id`
- `primary_contact_id`
- `stage`
- `probability_score`
- `target_commitment`
- `soft_circle_amount`
- `committed_amount`
- `wired_amount`
- `sector_interest`
- `last_touch_at`
- `next_touch_at`
- `best_next_action`
- `summary`
- `objections`
- `source`

Suggested active stages:

- `intro_requested`
- `first_meeting`
- `follow_up`
- `dd`
- `soft_circled`
- `legal_docs`

### portfolio_companies

This is the new first-class portfolio layer.

- `id`
- `name`
- `stage`
- `sector`
- `headquarters`
- `check_size`
- `ownership_pct`
- `valuation_entry`
- `website`
- `linkedin_url`
- `x_url`
- `preferred_channel`
- `founder_ids`
- `gmail_thread_url`
- `google_calendar_url`
- `google_drive_url`
- `google_doc_url`
- `google_sheet_url`
- `last_touch_at`
- `next_touch_at`
- `best_next_action`
- `health`
- `summary`

### tasks

Tasks should attach to the real operating object, not float in a generic queue.

- `id`
- `subject_type`
  - `pipeline`
  - `relationship`
  - `portfolio`
- `subject_id`
- `title`
- `description`
- `status`
- `priority`
- `due_at`

### activities

Activities unify relationship memory across systems.

- `id`
- `subject_type`
- `subject_id`
- `occurred_at`
- `interaction_type`
- `channel`
- `title`
- `summary`
- `source_label`
- `source_url`

### google_links

Google assets stay external but become first-class linked records.

- `id`
- `subject_type`
- `subject_id`
- `system`
  - `gmail`
  - `calendar`
  - `drive`
  - `docs`
  - `sheets`
- `label`
- `url`

## Product Rules

- `last_touch_at` should come from synced activity when integrations are real
- `next_touch_at` and `best_next_action` must stay explicit and visible
- LinkedIn belongs in the core model, not as an afterthought
- Google URLs should be visible on every important detail view
- portfolio company support should sit beside fundraising, not in a separate forgotten tool
- one-record detail views should answer: what is this, who matters, what happened last, what happens next, and where is the source material
