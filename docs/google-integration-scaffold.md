# Google Integration Scaffold

This iteration adds explicit product and server scaffolding for a Google-first future without making local startup harder.

## Implemented Now

- normalized seeded provider records for Gmail, Calendar, and Drive / Docs / Sheets
- explicit local routes:
  - `/api/integrations`
  - `/api/ops-summary`
- seeded upcoming moments, document links, and activity provenance so UI surfaces are already wired for sync-backed data later

## Next Practical Steps

1. Gmail
   - store Gmail thread IDs and last message metadata on activities or relationship records
   - derive tasks from unanswered asks or thread age thresholds

2. Calendar
   - store external event IDs on `upcoming_moments`
   - sync attendee status and event time changes into the dashboard and inspectors

3. Drive / Docs / Sheets
   - store file IDs beside URLs
   - sync title, modified time, and owner metadata
   - add stale-material detection for LP packets and board docs

## Suggested Shape

- keep Google-native files in Drive, Docs, and Sheets
- sync only metadata and pointers into Spice HQ
- avoid copying full documents into the app
- use synced metadata to surface:
  - stale diligence rooms
  - missing board materials
  - outdated committee packets
  - unanswered founder or LP requests tied to linked docs
