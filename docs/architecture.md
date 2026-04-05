# Spice HQ V2 Architecture

## Current Prototype

The app in this repo is intentionally lightweight:

- Node.js server
- static single-page frontend
- seeded local data module

That is enough to make the product shape reviewable now without introducing backend drag.

## V2 Product Shape

The information architecture is now organized around five surfaces:

1. HQ Home
2. Fundraising
3. Tasks
4. Relationships
5. Portfolio

This matches how Spice actually needs to operate:

- see what is happening now
- know what is overdue
- keep fundraising moving
- preserve relationship memory
- support portfolio companies without context switching

## System-Of-Record Direction

### Structured data

Use Postgres later for:

- organizations
- contacts
- fundraising pipeline
- portfolio companies
- tasks
- activities
- Google link metadata

### Files and working materials

Keep source files in Google:

- Gmail threads
- Calendar events
- Drive folders
- Docs
- Sheets

The product should store metadata and links, not re-host those artifacts.

## Integration Order

### First

- Google Workspace auth
- Gmail sync for thread links / latest touch
- Calendar sync for meetings
- Drive / Docs / Sheets metadata linkage

### Second

- LinkedIn enrichment or manual LinkedIn profile capture
- X / Twitter profiles
- WhatsApp or other lightweight founder channels

## Real App Path After This Prototype

Recommended path:

1. keep the current IA
2. stand up a Postgres-backed API
3. migrate seed objects into normalized tables
4. ingest Airtable into staging tables
5. add Google sync jobs
6. preserve external URLs as first-class linked records

The important rule is not to rebuild Airtable forever. Normalize for the product Spice actually wants.
