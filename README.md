# SolidBooked Pro Setter Funnel

Full-stack Next.js application for `setter.solidbookedpro.com`.

This is no longer a GitHub Pages-only static site. Duplicate prevention, autosave, qualification, Vapi webhook processing, and admin access require a server runtime. Deploy to Vercel or another Next.js host and point `setter.solidbookedpro.com` there.

The Supabase integration uses app-owned table names with the `sbp_setter_` prefix by default, such as `sbp_setter_applicants`. This keeps the application isolated from any existing Supabase tables/data in the same account.

## Stack

- Next.js App Router + TypeScript
- Supabase/Postgres through server-side PostgREST calls
- Zod validation
- Vapi Web SDK for browser mock calls
- Vapi server webhook endpoint for end-of-call reports
- Protected admin dashboard via basic auth plus admin API token

## Setup

1. In Supabase SQL Editor, run `db/schema.sql`. The script is additive: it uses `create table if not exists` for `sbp_setter_*` tables and does not drop or modify unrelated tables.
2. Copy `.env.example` to `.env.local` and fill values:
   - `SUPABASE_URL`: Project Settings → API → Project URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: Project Settings → API → service_role key. Keep this server-side only.
   - `SUPABASE_TABLE_PREFIX`: Leave as `sbp_setter_` unless you intentionally created a different isolated prefix.
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_API_TOKEN` for the protected dashboard/API.
3. Configure each Vapi assistant server URL to `/api/vapi/webhook`.
4. Set the three public assistant IDs and public Vapi key.
5. Set founder video, call recordings, and calendar embed URLs.

## Deployment note

GitHub Pages can host the static UI, but it cannot run the `/api/*` routes that save to Supabase. To make Supabase the source of truth for applications and the admin dashboard, deploy this Next.js app to a server runtime such as Vercel, Netlify, Render, or another Node-compatible host. Then point `setter.solidbookedpro.com` to that deployment instead of the static GitHub Pages artifact.

If you keep the current GitHub Pages deployment live, applicant data is only stored in that visitor's browser local storage and will not appear centrally in Supabase.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Notes

- Qualification rules and internal scores live in server code only.
- The browser receives only `qualified`, `manual_review`, or `not_qualified`.
- Local storage is only a convenience restore layer; Supabase is the source of truth.
