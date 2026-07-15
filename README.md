# SolidBooked Pro Setter Funnel

Next.js application for `setter.solidbookedpro.com`.

The production deployment can run as a GitHub Pages static export because the browser calls a Supabase RPC bridge for duplicate prevention, autosave, qualification, submission storage, and admin review. Local storage remains only a recovery layer for the applicant's current device.

The Supabase integration uses app-owned table names with the `sbp_setter_` prefix by default, such as `sbp_setter_applicants`. This keeps the application isolated from any existing Supabase tables/data in the same account.

## Stack

- Next.js App Router + TypeScript
- Supabase/Postgres through Next API routes or the static Pages RPC bridge
- Zod validation
- Vapi Web SDK for browser mock calls
- Vapi server webhook endpoint for end-of-call reports
- Protected admin dashboard via admin password/API token

## Setup

1. In Supabase SQL Editor, run `db/schema.sql`. The script is additive: it uses `create table if not exists` for `sbp_setter_*` tables and does not drop or modify unrelated tables.
2. For GitHub Pages/static mode, also run `db/supabase_bridge.sql` in the same isolated Supabase project.
3. Copy `.env.example` to `.env.local` and fill values:
   - `SUPABASE_URL`: Project Settings → API → Project URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: Project Settings → API → service_role key. Keep this server-side only.
   - `SUPABASE_TABLE_PREFIX`: Leave as `sbp_setter_` unless you intentionally created a different isolated prefix.
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Used only by static GitHub Pages mode to call `sbp_setter_bridge`.
   - `NEXT_PUBLIC_SETTER_BRIDGE_URL`: Optional override. Defaults to `<NEXT_PUBLIC_SUPABASE_URL>/rest/v1/rpc/sbp_setter_bridge`.
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_API_TOKEN` for the protected dashboard/API.
4. Configure each Vapi assistant server URL to `/api/vapi/webhook` when running on a server host. For static Pages, route Vapi webhooks to a server workflow that updates `sbp_setter_mock_calls`.
5. The Vapi public browser key and the three SolidBooked Pro mock-call assistant IDs are configured by default:
   - Mock Call 1: `32a6bb38-0a56-40db-ab03-2540f820cc56`
   - Mock Call 2: `bb12a1d4-47de-4c50-b3d5-eac9c79e4995`
   - Mock Call 3: `93f168a7-40ba-4144-a8f7-217358b4aa0a`
6. Set founder video, call recordings, and calendar embed URLs.

## Deployment note

GitHub Pages cannot run `/api/*` routes. In `build:pages` mode, the app uses `NEXT_PUBLIC_STATIC_PAGES_MODE=1` and sends application/admin actions to the Supabase RPC bridge instead. That is what keeps duplicate checks and admin review centralized on the live static site.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run build:pages
```

## Notes

- Qualification rules and internal scores live in server code or the Supabase bridge, not public front-end JavaScript.
- The browser receives only `qualified`, `manual_review`, or `not_qualified`.
- Local storage is only a convenience restore layer; Supabase is the source of truth.
