# Airtable Migration And Cutover

This prototype is not the migration itself. It is the target product shape the migration should land into.

## Goal

Move from Airtable into a cleaner Spice HQ data model without losing traceability, Google links, or relationship history.

## What To Export From Airtable

Export both schema and records.

Minimum export set:

- tables
- fields
- linked-record relationships
- views actually used by Maya
- record IDs
- attachments/URLs
- owner fields
- stage/status fields
- notes / activity fields

If there are multiple bases, map all of them before transforming anything.

## Staging Before Normalization

Do not load Airtable directly into final tables first.

Create staging tables such as:

- `airtable_tables`
- `airtable_fields`
- `airtable_records_raw`
- `airtable_attachments_raw`

This preserves the raw source and makes re-runs safe.

## Normalize Into V2 Tables

Map Airtable records into:

- `organizations`
- `contacts`
- `funds`
- `fundraising_pipeline`
- `portfolio_companies`
- `tasks`
- `activities`
- `google_links`

## Specific Mapping Rules

### Fundraising

- one Airtable pipeline row should become one `fundraising_pipeline` row
- preserve old Airtable record IDs on import for traceability
- convert formula-driven “last touch” into real activity-derived timestamps when possible

### Relationships

- split organizations and people cleanly if Airtable mixes them
- map LinkedIn to explicit profile fields
- capture preferred channel if it currently lives in free text

### Portfolio

- create a dedicated `portfolio_companies` table even if Airtable currently hides this inside notes or mixed views
- founders should become contact rows linked to a company
- check size and ownership belong on the company investment record, not in random notes

### Google

Capture and normalize:

- Gmail thread links
- Calendar event links
- Drive folder links
- Docs links
- Sheets links

The file itself can remain in Google. The CRM stores the pointer.

## Suggested Cutover

1. Freeze Airtable edits for a final export window.
2. Export schema + records + links.
3. Load raw data into staging tables.
4. Transform into V2 tables.
5. QA stage counts, next actions, company lists, and key Google links.
6. Run internal testing in Spice HQ.
7. Switch active workflow into the new app.
8. Keep Airtable read-only as archive until confidence is high.

## QA Checklist

- fundraising stage counts match expectations
- top LP relationships exist with correct primary contact and next action
- overdue follow-ups are visible
- portfolio companies have founders, check, ownership, and next touch
- Google links open the right threads/docs/folders
- LinkedIn fields survived the migration
