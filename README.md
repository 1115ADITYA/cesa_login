# CESA portal

Member accounts (Supabase Auth: email/password + Google), an events board,
team registration with friend invites, a notification centre, and a separate
admin panel for managing events and rosters.

## Setup

1. **Supabase project** — the one this app already points at (or a fresh one).
   Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` — same page, the `service_role` secret. **Never**
     prefix this with `NEXT_PUBLIC_`; it bypasses Row Level Security entirely,
     which is exactly what the admin panel needs since admins are not Supabase
     Auth users.
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD` — the separate admin login, unrelated to
     any member's account. Pick your own before deploying.

2. **Run the migration** — `supabase/migrations/0001_events.sql` in the
   Supabase SQL editor (or `supabase db push` if you use the CLI). It assumes
   `public.profiles(id, username, full_name, avatar_url, role)` already exists
   — the table the signup flow in `app/page.tsx` already writes to.

3. `npm install && npm run dev`.

## What's here

- **`/events`** — Happening now / Upcoming / Your events. Registering opens a
  team (a name you pick) and can invite teammates by username in the same
  step; `/events/[id]` also lets an already-registered member invite more
  people afterwards.
- **Notifications**, on `/dashboard` — pending team invitations, with
  Accept/Decline. Accepting is what moves an event from "invited" to
  "your events."
- **`/admin`** — a separate login (`ADMIN_USERNAME`/`ADMIN_PASSWORD`, an
  8-hour session cookie). From `/admin/events`: create, edit, and delete
  events; per event, `/admin/events/[id]/teams` lists every registered team
  and lets an admin rename a team, add or remove any member directly (no
  invite needed), or remove the whole team.

Registration writes (creating a team, inviting, accepting/declining) go
through three Postgres RPCs in the migration
(`register_for_event`/`invite_to_team`/`respond_to_invite`) rather than direct
table writes — a registration is "create the team, add me as accepted, add
every invite" as one atomic step, which plain RLS policies can't express on
their own. Admin writes go through the service-role client instead, bypassing
RLS entirely, since an admin session isn't a Supabase Auth user at all.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
