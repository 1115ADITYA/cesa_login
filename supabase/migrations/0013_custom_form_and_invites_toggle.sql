-- Custom registration forms, per-event username invites, and video uploads.
--
-- 1. events.form_fields — the admin's Google-Form-style questions, as a JSON
--    array of field definitions (see src/lib/formFields.ts for the shape). One
--    column rather than a table: the form is always read and written whole,
--    together with the event, and never queried field by field.
--
-- 2. event_teams.form_answers — the team leader's answers, keyed by field id.
--    Filled once per team. Written only by the server (service role) after it
--    has validated the answers against the event's current fields.
--
-- 3. events.allow_invites — "Invite teammates by username", on by default so
--    every existing event behaves exactly as before. When off, the app saves
--    the event as solo (max team size 1) and the trigger below refuses invites
--    at the database, whatever calls invite_to_team().
--
-- 4. Storage bucket `event-submissions` for video answers. Private: videos are
--    entrants' work, so admins open them through short-lived signed URLs, never
--    a public address. Members upload straight from the browser (a video is far
--    bigger than a server action's request body allows), so INSERT is granted
--    to signed-in users, but only under their own folder:
--        <event id>/<their user id>/<random>.<ext>
--
-- Run after 0012. Idempotent.

alter table public.events add column if not exists form_fields jsonb not null default '[]'::jsonb;
alter table public.events add column if not exists allow_invites boolean not null default true;
alter table public.event_teams add column if not exists form_answers jsonb not null default '{}'::jsonb;

alter table public.events drop constraint if exists events_form_fields_is_array;
alter table public.events add constraint events_form_fields_is_array
  check (jsonb_typeof(form_fields) = 'array');

-- ---------------------------------------------------------------------------
-- No username invites when the event has them switched off. A trigger rather
-- than an edit to invite_to_team(), so the rule holds for every write path.
-- Admin "add directly" inserts members as 'accepted', which stays allowed.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_invites_allowed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'invited' and exists (
    select 1
      from public.event_teams t
      join public.events e on e.id = t.event_id
     where t.id = new.team_id
       and not e.allow_invites
  ) then
    raise exception 'Inviting teammates is turned off for this event';
  end if;
  return new;
end;
$$;

drop trigger if exists event_team_members_invites_allowed on public.event_team_members;
create trigger event_team_members_invites_allowed
  before insert or update of status on public.event_team_members
  for each row execute function public.enforce_invites_allowed();

-- ---------------------------------------------------------------------------
-- Video bucket. file_size_limit is left null: each video question carries its
-- own size limit, checked in the browser and again on the server. Supabase's
-- project-wide upload limit (Storage → Settings) still caps every file.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-submissions',
  'event-submissions',
  false,
  null,
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "event submissions: upload own" on storage.objects;
create policy "event submissions: upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-submissions'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "event submissions: read own" on storage.objects;
create policy "event submissions: read own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'event-submissions'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "event submissions: delete own" on storage.objects;
create policy "event submissions: delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-submissions'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
