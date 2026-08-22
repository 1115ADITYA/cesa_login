-- Events, team registration, and invitations.
--
-- Run this once in the Supabase SQL editor (or via `supabase db push` if you
-- use the CLI) against the SAME project cesa_login already points at — it
-- assumes `public.profiles(id uuid primary key references auth.users, username
-- text unique, full_name text, avatar_url text, role text)` already exists,
-- which is what app/page.tsx's signup RPC creates.

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  location text,
  banner_url text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Registration closes at this instant. Null means "open until the event starts".
  registration_closes_at timestamptz,
  -- 1 means solo registration; NULL means no cap.
  max_team_size int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_ends_after_starts check (ends_at >= starts_at)
);

create index if not exists events_starts_at_idx on public.events (starts_at);

-- ---------------------------------------------------------------------------
-- event_teams — one row per team registered for one event
-- ---------------------------------------------------------------------------
create table if not exists public.event_teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint event_teams_name_len check (char_length(trim(name)) between 2 and 60),
  -- One team per person per event — re-registering edits the existing team
  -- instead of creating a second one.
  unique (event_id, created_by)
);

create index if not exists event_teams_event_idx on public.event_teams (event_id);

-- ---------------------------------------------------------------------------
-- event_team_members — the roster, including pending invitations
-- ---------------------------------------------------------------------------
create table if not exists public.event_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.event_teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'accepted', 'declined')),
  invited_by uuid references public.profiles (id) on delete set null,
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (team_id, user_id)
);

create index if not exists event_team_members_user_idx on public.event_team_members (user_id, status);
create index if not exists event_team_members_team_idx on public.event_team_members (team_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Members only ever reach these tables through the RPCs below, which run as
-- SECURITY DEFINER — so the table policies just need to cover plain reads
-- (everyone can see events; a member can see teams/rosters they belong to)
-- and can otherwise stay closed. Admin pages use the service-role key, which
-- bypasses RLS entirely, so they need no policies of their own.
-- ---------------------------------------------------------------------------

alter table public.events enable row level security;
alter table public.event_teams enable row level security;
alter table public.event_team_members enable row level security;

create policy events_read_all on public.events
  for select to authenticated using (true);

create policy event_teams_read_own on public.event_teams
  for select to authenticated using (
    created_by = auth.uid()
    or exists (
      select 1 from public.event_team_members m
      where m.team_id = event_teams.id and m.user_id = auth.uid()
    )
  );

create policy event_team_members_read_own on public.event_team_members
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.event_teams t
      where t.id = event_team_members.team_id and t.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- register_for_event — creates (or replaces) the caller's team for an event
-- and invites the given usernames. Runs as SECURITY DEFINER so a single call
-- can insert the team plus every invite atomically under RLS, the same
-- pattern create_profile_after_signup already uses for the signup flow.
-- ---------------------------------------------------------------------------
create or replace function public.register_for_event(
  p_event_id uuid,
  p_team_name text,
  p_invite_usernames text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_max_team_size int;
  v_closes_at timestamptz;
  v_starts_at timestamptz;
  v_invitee uuid;
  v_username text;
  v_member_count int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select max_team_size, registration_closes_at, starts_at
    into v_max_team_size, v_closes_at, v_starts_at
    from public.events where id = p_event_id;

  if not found then
    raise exception 'Unknown event';
  end if;
  if coalesce(v_closes_at, v_starts_at) <= now() then
    raise exception 'Registration is closed for this event';
  end if;
  if char_length(trim(p_team_name)) < 2 then
    raise exception 'Team name is too short';
  end if;

  insert into public.event_teams (event_id, name, created_by)
  values (p_event_id, trim(p_team_name), auth.uid())
  on conflict (event_id, created_by) do update set name = excluded.name
  returning id into v_team_id;

  insert into public.event_team_members (team_id, user_id, status, invited_by, responded_at)
  values (v_team_id, auth.uid(), 'accepted', auth.uid(), now())
  on conflict (team_id, user_id) do nothing;

  foreach v_username in array coalesce(p_invite_usernames, '{}') loop
    v_username := trim(lower(v_username));
    if v_username = '' then
      continue;
    end if;

    select id into v_invitee from public.profiles where lower(username) = v_username;
    if v_invitee is null or v_invitee = auth.uid() then
      continue;
    end if;

    select count(*) into v_member_count from public.event_team_members where team_id = v_team_id;
    if v_max_team_size is not null and v_member_count >= v_max_team_size then
      exit;
    end if;

    insert into public.event_team_members (team_id, user_id, status, invited_by)
    values (v_team_id, v_invitee, 'invited', auth.uid())
    on conflict (team_id, user_id) do nothing;
  end loop;

  return v_team_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- respond_to_invite — accept or decline an invitation sent to the caller.
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_invite(
  p_membership_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.event_team_members
     set status = case when p_accept then 'accepted' else 'declined' end,
         responded_at = now()
   where id = p_membership_id
     and user_id = auth.uid()
     and status = 'invited';

  if not found then
    raise exception 'No pending invitation with that id for you';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- invite_to_team — an existing accepted member invites one more username.
-- Separate from register_for_event so the "invite a friend" action on an
-- already-registered team doesn't need to re-send the team name.
-- ---------------------------------------------------------------------------
create or replace function public.invite_to_team(
  p_team_id uuid,
  p_username text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitee uuid;
  v_max_team_size int;
  v_member_count int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.event_team_members
    where team_id = p_team_id and user_id = auth.uid() and status = 'accepted'
  ) then
    raise exception 'Only a team member can invite others';
  end if;

  select id into v_invitee from public.profiles where lower(username) = trim(lower(p_username));
  if v_invitee is null then
    raise exception 'No account with that username';
  end if;

  select e.max_team_size into v_max_team_size
    from public.event_teams t join public.events e on e.id = t.event_id
    where t.id = p_team_id;

  select count(*) into v_member_count from public.event_team_members where team_id = p_team_id;
  if v_max_team_size is not null and v_member_count >= v_max_team_size then
    raise exception 'This team is already full';
  end if;

  insert into public.event_team_members (team_id, user_id, status, invited_by)
  values (p_team_id, v_invitee, 'invited', auth.uid())
  on conflict (team_id, user_id) do nothing;
end;
$$;
