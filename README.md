# Spice HQ

Spice HQ is the internal CRM and operating system for Spice Capital.

## Current scope

- Google sign-in via Supabase
- MVP allowlist for `arpuroh@gmail.com`
- Fund III dashboard shell
- Live fundraising, contacts, and interactions views from Supabase
- Minimal add-person and add-organization flows writing back to Supabase
- Documentation for data model, architecture, and migration

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Required environment variables

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` for server-side write flows

## Auth wiring

Supabase Auth should use:

- Site URL: `https://spice-hq.vercel.app`
- Redirect URL: `https://spice-hq.vercel.app/auth/callback`
- Local redirect URL: `http://localhost:3000/auth/callback`

Google provider should be enabled in Supabase.

## Deployment

This repo is intended to deploy from the **repository root** on Vercel.
