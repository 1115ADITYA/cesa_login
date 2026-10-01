-- Two things an admin could not do before.
--
-- 1. Publish an event before its date is fixed. starts_at/ends_at become
--    nullable; while they are null the event shows date_label instead ("Coming
--    Soon" unless the admin wrote something else). Both dates are set together
--    or not at all — half a schedule is not something any page can describe.
--
-- 2. Point members at an outside registration page (Unstop, a Google Form…).
--    join_url holds the link; show_join_button decides whether the Join Now
--    button is on, so an admin can hide it without losing the link.
--
-- Run after 0010. Idempotent.

alter table public.events alter column starts_at drop not null;
alter table public.events alter column ends_at drop not null;

alter table public.events add column if not exists date_label text;
alter table public.events add column if not exists join_url text;
alter table public.events add column if not exists show_join_button boolean not null default false;

alter table public.events drop constraint if exists events_dates_together;
alter table public.events add constraint events_dates_together
  check ((starts_at is null) = (ends_at is null));

alter table public.events drop constraint if exists events_join_url_http;
alter table public.events add constraint events_join_url_http
  check (join_url is null or join_url ~* '^https?://');

alter table public.events drop constraint if exists events_join_button_needs_url;
alter table public.events add constraint events_join_button_needs_url
  check (not show_join_button or join_url is not null);

-- With no date and no explicit deadline, registration stays open. Without the
-- 'infinity' fallback the comparison is null, which every caller reads as
-- "closed" — an event announced as Coming Soon would refuse every sign-up.
create or replace function public.registration_is_open(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(e.registration_closes_at, e.starts_at, 'infinity'::timestamptz) > now()
    from public.events e where e.id = p_event_id;
$$;
