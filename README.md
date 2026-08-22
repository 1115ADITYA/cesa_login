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

2. **Run the migrations, in order** — `supabase/migrations/0001_events.sql`
   then `0002_team_flow.sql`, in the Supabase SQL editor (or `supabase db
   push` if you use the CLI). They assume `public.profiles(id, username,
   full_name, avatar_url, role)` already exists — the table the signup flow in
   `app/page.tsx` already writes to. Both are idempotent.

3. `npm install && npm run dev`.

## The registration flow

Modelled on how Unstop handles team events: **register first, build the team
after.**

1. **Register** (`/events/[id]`) — pick a team name and you are in. Your seat
   is held immediately; nothing else is required at this point. On a solo event
   (max team size 1) there is no team name to invent — one button.
2. **Invite** — the team page has an **Invite a friend** button with a username
   typeahead. Only the team leader manages the roster. Pending invites hold a
   seat; declined ones release theirs, and a person who declined can be asked
   again.
3. **Confirm** — the registration is *provisional* until `min_team_size`
   members have **accepted**. Until then every surface shows "N more to
   confirm" with a progress bar; once the threshold is met the team reads
   "Registration confirmed".

A member can leave a team and a leader can cancel the registration outright,
any time before the event starts. Nobody can be on two teams for the same
event — enforced at registration, at invite time, and again at the moment an
invite is accepted.

## What's here

- **`/events`** — Your events, Happening now, Open for registration,
  Registration closed, Past. Each card carries the team's confirmation
  progress.
- **`/events/[id]`** — the event, then either the registration form or the team
  panel (roster, invite button, withdraw).
- **`/dashboard`** — notification centre for pending invitations, plus every
  registration with its confirmation state.
- **`/admin`** — a separate login (`ADMIN_USERNAME`/`ADMIN_PASSWORD`, an
  8-hour session cookie). From `/admin/events`: create, edit, and delete events
  (including min/max team size); per event, `/admin/events/[id]/teams` lists
  every registered team with its confirmed/forming status, and lets an admin
  rename a team, add or remove any member directly (no invite needed), or
  remove the whole team.

Every member-facing read and write goes through a SECURITY DEFINER Postgres
function rather than a direct table query. Writes need it because each step has
to re-check the deadline, the team's capacity and the one-team-per-event rule
against live data in a single statement, which RLS policies cannot express.
Reads need it because the invitation feed has to show *another member's*
username, and `profiles` is not readable member-to-member — the functions
return exactly the columns the UI needs and never the email column. Admin
writes go through the service-role client instead, bypassing RLS entirely,
since an admin session isn't a Supabase Auth user at all.

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
