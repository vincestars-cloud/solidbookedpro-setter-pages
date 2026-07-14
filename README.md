# SolidBooked Pro Setter Funnel

Full-stack Next.js application for `setter.solidbookedpro.com`.

This is no longer a GitHub Pages-only static site. Duplicate prevention, autosave, qualification, Vapi webhook processing, and admin access require a server runtime. Deploy to Vercel or another Next.js host and point `setter.solidbookedpro.com` there.

## Stack

- Next.js App Router + TypeScript
- Supabase/Postgres through server-side PostgREST calls
- Zod validation
- Vapi Web SDK for browser mock calls
- Vapi server webhook endpoint for end-of-call reports
- Protected admin dashboard via basic auth plus admin API token

## Setup

1. Create the Supabase tables with `db/schema.sql`.
2. Copy `.env.example` to `.env.local` and fill values.
3. Configure each Vapi assistant server URL to `/api/vapi/webhook`.
4. Set the three public assistant IDs and public Vapi key.
5. Set founder video, call recordings, and calendar embed URLs.

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
