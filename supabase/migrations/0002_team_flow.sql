-- Register-first, invite-after team flow (the way Unstop does it) plus the
-- integrity fixes 0001 was missing.
--
-- Run this AFTER 0001_events.sql in the Supabase SQL editor. It is idempotent
-- — re-running it is safe.
--
-- What changes, and why:
--
--  * `min_team_size` — a registration is only *confirmed* once that many
--    people have accepted. Registering alone is now a valid first step: you
--    get a team immediately, in a "forming" state, and invite from there.
--
--  * Every member-facing read now goes through a SECURITY DEFINER function
--    instead of a PostgREST join. The joins in 0001 leaned on `profiles` being
--    readable by other users, which it is not guaranteed to be — the inviter's
--    username silently rendered as "someone". These functions return exactly
--    the columns the UI needs (username, full name, avatar) and never the
--    email column.
--
--  * Capacity now counts `invited` + `accepted` and ignores `declined`, so a
--    declined seat frees up instead of permanently occupying the team.
--
--  * You can no longer end up on two teams for the same event, whether by
--    registering while already on a friend's team, by accepting a second
--    invite, or by being invited into one after joining another.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

alter table public.events
  add column if not exists min_team_size int not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_team_size_sane') then
    alter table public.events add constraint events_team_size_sane check (
      min_team_size >= 1
      and (max_team_size is null or max_team_size >= min_team_size)
    );
  end if;
end $$;

-- Two teams with the same name in one event make the roster lists ambiguous
-- for admins and for the teams themselves.
create unique index if not exists event_teams_unique_name_per_event
  on public.event_teams (event_id, lower(trim(name)));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- "Is registration still open" in one place — every write path checked this
-- slightly differently before, and `respond_to_invite` did not check it at all.
create or replace function public.registration_is_open(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(e.registration_closes_at, e.starts_at) > now()
    from public.events e where e.id = p_event_id;
$$;

-- Seats taken: pending invites hold a seat, declines release theirs.
create or replace function public.team_seat_count(p_team_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.event_team_members
   where team_id = p_team_id and status in ('invited', 'accepted');
$$;

create or replace function public.is_on_a_team_for_event(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.event_team_members m
      join public.event_teams t on t.id = m.team_id
     where t.event_id = p_event_id
       and m.user_id = p_user_id
       and m.status = 'accepted'
  );
$$;

-- ---------------------------------------------------------------------------
-- register_for_event — step one. Creates the caller's team with the caller as
-- its only (accepted) member. Invites are a separate step now, so a half-typed
-- friend list can no longer block someone from registering at all.
-- ---------------------------------------------------------------------------

-- 0001's three-argument version took an invite array; drop it so the two-arg
-- version below is unambiguous.
drop function if exists public.register_for_event(uuid, text, text[]);

create or replace function public.register_for_event(
  p_event_id uuid,
  p_team_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_team_id uuid;
  v_max int;
  v_name text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select max_team_size into v_max from public.events where id = p_event_id;
  if not found then
    raise exception 'Unknown event';
  end if;
  if not public.registration_is_open(p_event_id) then
    raise exception 'Registration for this event has closed';
  end if;

  -- Already on somebody else's roster: registering again would silently put
  -- this person on two teams for one event.
  if exists (
    select 1
      from public.event_team_members m
      join public.event_teams t on t.id = m.team_id
     where t.event_id = p_event_id
       and m.user_id = v_uid
       and m.status = 'accepted'
       and t.created_by <> v_uid
  ) then
    raise exception 'You have already joined a team for this event';
  end if;

  v_name := nullif(trim(coalesce(p_team_name, '')), '');
  if v_name is null then
    if v_max = 1 then
      -- Solo event: nobody should have to invent a team name for a team of one.
      select coalesce(nullif(trim(full_name), ''), username)
        into v_name from public.profiles where id = v_uid;
      v_name := coalesce(v_name, 'Participant');
    else
      raise exception 'Please give your team a name';
    end if;
  end if;

  if char_length(v_name) < 2 then
    raise exception 'Team name must be at least 2 characters';
  end if;
  if char_length(v_name) > 60 then
    raise exception 'Team name must be 60 characters or fewer';
  end if;

  begin
    insert into public.event_teams (event_id, name, created_by)
    values (p_event_id, v_name, v_uid)
    on conflict (event_id, created_by) do update set name = excluded.name
    returning id into v_team_id;
  exception when unique_violation then
    raise exception 'Another team for this event is already called "%"', v_name;
  end;

  insert into public.event_team_members (team_id, user_id, status, invited_by, responded_at)
  values (v_team_id, v_uid, 'accepted', v_uid, now())
  on conflict (team_id, user_id) do update
    set status = 'accepted', responded_at = coalesce(event_team_members.responded_at, now());

  return v_team_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- invite_to_team — step two, and the button this whole flow is built around.
-- Leader-only: on Unstop the leader owns the roster, and "any member can
-- invite" made it impossible to say who was responsible for a team going over
-- its intended size.
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
  v_uid uuid := auth.uid();
  v_event_id uuid;
  v_leader uuid;
  v_max int;
  v_invitee uuid;
  v_existing text;
  v_name text := trim(p_username);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select t.event_id, t.created_by, e.max_team_size
    into v_event_id, v_leader, v_max
    from public.event_teams t
    join public.events e on e.id = t.event_id
   where t.id = p_team_id;
  if not found then
    raise exception 'Unknown team';
  end if;

  if v_leader <> v_uid then
    raise exception 'Only the team leader can invite members';
  end if;
  if not public.registration_is_open(v_event_id) then
    raise exception 'Registration for this event has closed';
  end if;

  select id into v_invitee from public.profiles where lower(username) = lower(v_name);
  if v_invitee is null then
    raise exception 'No CESA account with the username "%"', v_name;
  end if;
  if v_invitee = v_uid then
    raise exception 'You are already on this team';
  end if;

  select status into v_existing
    from public.event_team_members
   where team_id = p_team_id and user_id = v_invitee;

  if v_existing = 'accepted' then
    raise exception '@% is already on your team', v_name;
  end if;
  if v_existing = 'invited' then
    raise exception '@% already has a pending invite from you', v_name;
  end if;

  if public.is_on_a_team_for_event(v_event_id, v_invitee) then
    raise exception '@% has already joined another team for this event', v_name;
  end if;

  if v_max is not null and public.team_seat_count(p_team_id) >= v_max then
    raise exception 'Your team is full (% seats, including pending invites)', v_max;
  end if;

  -- `do update` rather than `do nothing`: someone who declined once can be
  -- asked again, which 0001 made permanently impossible.
  insert into public.event_team_members (team_id, user_id, status, invited_by, invited_at, responded_at)
  values (p_team_id, v_invitee, 'invited', v_uid, now(), null)
  on conflict (team_id, user_id) do update
    set status = 'invited', invited_by = v_uid, invited_at = now(), responded_at = null;
end;
$$;

-- ---------------------------------------------------------------------------
-- respond_to_invite — step three. Accepting is what actually confirms a team.
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
declare
  v_uid uuid := auth.uid();
  v_team_id uuid;
  v_event_id uuid;
  v_max int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select m.team_id, t.event_id, e.max_team_size
    into v_team_id, v_event_id, v_max
    from public.event_team_members m
    join public.event_teams t on t.id = m.team_id
    join public.events e on e.id = t.event_id
   where m.id = p_membership_id
     and m.user_id = v_uid
     and m.status = 'invited';
  if not found then
    raise exception 'That invitation is no longer pending';
  end if;

  if p_accept then
    if not public.registration_is_open(v_event_id) then
      raise exception 'Registration for this event has closed';
    end if;
    if public.is_on_a_team_for_event(v_event_id, v_uid) then
      raise exception 'You have already joined another team for this event';
    end if;
    -- The leader may have had an admin add people directly since the invite
    -- went out, so re-check the cap at the moment of acceptance.
    if v_max is not null and (
      select count(*) from public.event_team_members
       where team_id = v_team_id and status = 'accepted'
    ) >= v_max then
      raise exception 'This team is already full';
    end if;
  end if;

  update public.event_team_members
     set status = case when p_accept then 'accepted' else 'declined' end,
         responded_at = now()
   where id = p_membership_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- remove_team_member — the leader withdrawing an invite or dropping someone.
-- ---------------------------------------------------------------------------
create or replace function public.remove_team_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_leader uuid;
  v_member uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select t.created_by, m.user_id
    into v_leader, v_member
    from public.event_team_members m
    join public.event_teams t on t.id = m.team_id
   where m.id = p_membership_id;
  if not found then
    raise exception 'No such member';
  end if;

  if v_leader <> v_uid then
    raise exception 'Only the team leader can change the roster';
  end if;
  if v_member = v_uid then
    raise exception 'You cannot remove yourself — withdraw the registration instead';
  end if;

  delete from public.event_team_members where id = p_membership_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- withdraw_registration — the leader cancels the whole entry, or a member
-- leaves. Without this, a wrong team name or a wrong event was permanent.
-- ---------------------------------------------------------------------------
create or replace function public.withdraw_registration(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_leader uuid;
  v_starts timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select t.created_by, e.starts_at
    into v_leader, v_starts
    from public.event_teams t
    join public.events e on e.id = t.event_id
   where t.id = p_team_id;
  if not found then
    raise exception 'Unknown team';
  end if;
  if v_starts <= now() then
    raise exception 'This event has already started';
  end if;

  if v_leader = v_uid then
    -- Roster rows cascade with the team.
    delete from public.event_teams where id = p_team_id;
  else
    delete from public.event_team_members where team_id = p_team_id and user_id = v_uid;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reads. All of these are SECURITY DEFINER and hand-pick their columns, so
-- they work regardless of how `profiles` is locked down and never leak the
-- email column.
-- ---------------------------------------------------------------------------

-- Username autocomplete for the invite box. Deliberately prefix-matched and
-- capped: this is "finish typing my friend's handle", not a member directory.
create or replace function public.search_usernames(
  p_query text,
  p_event_id uuid default null
)
returns table (
  username text,
  full_name text,
  avatar_url text,
  unavailable boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := lower(trim(coalesce(p_query, '')));
begin
  if auth.uid() is null or char_length(v_q) < 2 then
    return;
  end if;

  return query
    select p.username,
           p.full_name,
           p.avatar_url,
           case when p_event_id is null then false
                else public.is_on_a_team_for_event(p_event_id, p.id) end
      from public.profiles p
     where p.id <> auth.uid()
       and p.username is not null
       and lower(p.username) like v_q || '%'
     order by p.username
     limit 8;
end;
$$;

create or replace function public.get_my_invitations()
returns table (
  membership_id uuid,
  event_id uuid,
  event_title text,
  event_starts_at timestamptz,
  team_id uuid,
  team_name text,
  invited_by_username text,
  invited_by_full_name text,
  invited_at timestamptz,
  accepted_count int,
  min_team_size int,
  max_team_size int,
  registration_open boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
    select m.id,
           e.id,
           e.title,
           e.starts_at,
           t.id,
           t.name,
           inviter.username,
           inviter.full_name,
           m.invited_at,
           (select count(*)::int from public.event_team_members am
             where am.team_id = t.id and am.status = 'accepted'),
           e.min_team_size,
           e.max_team_size,
           public.registration_is_open(e.id)
      from public.event_team_members m
      join public.event_teams t on t.id = m.team_id
      join public.events e on e.id = t.event_id
      left join public.profiles inviter on inviter.id = m.invited_by
     where m.user_id = auth.uid()
       and m.status = 'invited'
     order by m.invited_at desc;
end;
$$;

-- One row per event the caller is involved in, whether they lead the team or
-- were invited into it. `dashboard` and `/events` both keyed off `created_by`
-- before, so joining a friend's team left you looking unregistered.
create or replace function public.get_my_registrations()
returns table (
  event_id uuid,
  team_id uuid,
  team_name text,
  my_status text,
  is_leader boolean,
  accepted_count int,
  pending_count int,
  min_team_size int,
  max_team_size int,
  confirmed boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
    select t.event_id,
           t.id,
           t.name,
           m.status,
           t.created_by = auth.uid(),
           counts.accepted,
           counts.pending,
           e.min_team_size,
           e.max_team_size,
           counts.accepted >= e.min_team_size
      from public.event_team_members m
      join public.event_teams t on t.id = m.team_id
      join public.events e on e.id = t.event_id
      cross join lateral (
        select (count(*) filter (where am.status = 'accepted'))::int as accepted,
               (count(*) filter (where am.status = 'invited'))::int as pending
          from public.event_team_members am where am.team_id = t.id
      ) counts
     where m.user_id = auth.uid()
       and m.status in ('accepted', 'invited');
end;
$$;

-- The caller's team for one event, roster included, as a single JSON blob.
create or replace function public.get_event_team(p_event_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_team_id uuid;
  v_team_name text;
  v_leader uuid;
  v_result json;
begin
  if v_uid is null then
    return null;
  end if;

  select t.id, t.name, t.created_by
    into v_team_id, v_team_name, v_leader
    from public.event_teams t
    join public.event_team_members m on m.team_id = t.id
   where t.event_id = p_event_id
     and m.user_id = v_uid
     and m.status in ('accepted', 'invited')
   -- If somehow both exist, the team they actually joined wins over a pending
   -- invite from someone else.
   order by (m.status = 'accepted') desc, (t.created_by = v_uid) desc
   limit 1;

  if v_team_id is null then
    return null;
  end if;

  select json_build_object(
    'id', v_team_id,
    'name', v_team_name,
    'isLeader', v_leader = v_uid,
    'members', coalesce((
      select json_agg(
        json_build_object(
          'id', m.id,
          'status', m.status,
          'username', p.username,
          'fullName', p.full_name,
          'avatarUrl', p.avatar_url,
          'isLeader', m.user_id = v_leader,
          'isMe', m.user_id = v_uid
        )
        order by (m.user_id = v_leader) desc, m.invited_at
      )
      from public.event_team_members m
      join public.profiles p on p.id = m.user_id
      where m.team_id = v_team_id
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants — RPCs are callable by signed-in members only; each one re-checks
-- auth.uid() itself, since SECURITY DEFINER means the policies do not apply.
-- ---------------------------------------------------------------------------
revoke all on function public.register_for_event(uuid, text) from public, anon;
revoke all on function public.invite_to_team(uuid, text) from public, anon;
revoke all on function public.respond_to_invite(uuid, boolean) from public, anon;
revoke all on function public.remove_team_member(uuid) from public, anon;
revoke all on function public.withdraw_registration(uuid) from public, anon;
revoke all on function public.search_usernames(text, uuid) from public, anon;
revoke all on function public.get_my_invitations() from public, anon;
revoke all on function public.get_my_registrations() from public, anon;
revoke all on function public.get_event_team(uuid) from public, anon;

grant execute on function public.register_for_event(uuid, text) to authenticated;
grant execute on function public.invite_to_team(uuid, text) to authenticated;
grant execute on function public.respond_to_invite(uuid, boolean) to authenticated;
grant execute on function public.remove_team_member(uuid) to authenticated;
grant execute on function public.withdraw_registration(uuid) to authenticated;
grant execute on function public.search_usernames(text, uuid) to authenticated;
grant execute on function public.get_my_invitations() to authenticated;
grant execute on function public.get_my_registrations() to authenticated;
grant execute on function public.get_event_team(uuid) to authenticated;
