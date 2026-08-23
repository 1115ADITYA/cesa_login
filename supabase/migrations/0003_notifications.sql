-- Notifications for everything that happens to you, not just pending invites.
--
-- Run this AFTER 0002_team_flow.sql. It is idempotent.
--
-- Before this, the bell was fed entirely by get_my_invitations(), which
-- returns rows with status = 'invited'. So the only thing a member could ever
-- be told about was an invitation still awaiting their answer. Being removed
-- from a team, a team being disbanded, an event being cancelled or moved, or
-- someone finally accepting your invite — none of it produced anything.
--
-- Written as triggers rather than in the application on purpose: the admin
-- panel writes through the service-role client and never touches the member
-- RPCs, so app-level notification calls would silently miss every admin
-- action. In the database, one rule covers every path in.

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'invite_received', 'invite_accepted', 'invite_declined',
    'removed_from_team', 'team_disbanded', 'team_confirmed',
    'event_updated', 'event_cancelled'
  )),
  title text not null,
  body text not null,
  -- Deliberately NOT a foreign key, and the human-readable text is baked in at
  -- write time: "this event was cancelled" has to outlive the event row it
  -- refers to, and a join would return nothing once the row is gone.
  event_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'notifications' and policyname = 'notifications_read_own') then
    create policy notifications_read_own on public.notifications
      for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'notifications' and policyname = 'notifications_update_own') then
    -- Only ever used to set read_at; there is no insert policy at all, so the
    -- triggers below are the single writer.
    create policy notifications_update_own on public.notifications
      for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'notifications' and policyname = 'notifications_delete_own') then
    create policy notifications_delete_own on public.notifications
      for delete to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.push_notification(
  p_user uuid, p_kind text, p_title text, p_body text, p_event uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Never notify nobody, and never notify the person who caused the change.
  if p_user is null or p_user = auth.uid() then
    return;
  end if;
  -- A cascading profile delete fires these triggers after the row is gone; a
  -- notification addressed to it would fail the foreign key and abort the
  -- whole delete. See 0004.
  if not exists (select 1 from public.profiles where id = p_user) then
    return;
  end if;
  insert into public.notifications (user_id, kind, title, body, event_id)
  values (p_user, p_kind, p_title, p_body, p_event);
end;
$$;

create or replace function public.actor_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce('@' || (select username from public.profiles where id = auth.uid()), 'An organiser');
$$;

-- A cascading delete fires the child triggers too. Without a marker, deleting
-- one event would tell every member "you were removed from your team" once per
-- membership, on top of the cancellation notice. These flags are transaction
-- local (set_config with is_local = true) and let the child triggers know a
-- parent is already handling the announcement.
create or replace function public.deleting_flag(p_key text)
returns text
language sql
stable
as $$
  select nullif(coalesce(current_setting(p_key, true), ''), '');
$$;

-- ---------------------------------------------------------------------------
-- Invitations: received, accepted, declined
-- ---------------------------------------------------------------------------
create or replace function public.notify_member_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team text; v_event text; v_event_id uuid;
begin
  if new.status <> 'invited' then
    return new;
  end if;

  select t.name, e.title, e.id into v_team, v_event, v_event_id
    from public.event_teams t join public.events e on e.id = t.event_id
   where t.id = new.team_id;

  perform public.push_notification(
    new.user_id, 'invite_received',
    'Team invitation',
    public.actor_name() || ' invited you to join ' || v_team || ' for ' || v_event || '.',
    v_event_id);

  return new;
end;
$$;

create or replace function public.notify_member_responded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team text; v_event text; v_event_id uuid; v_leader uuid;
  v_accepted int; v_min int;
begin
  if old.status <> 'invited' or new.status = old.status then
    return new;
  end if;

  select t.name, e.title, e.id, t.created_by, e.min_team_size
    into v_team, v_event, v_event_id, v_leader, v_min
    from public.event_teams t join public.events e on e.id = t.event_id
   where t.id = new.team_id;

  if new.status = 'accepted' then
    perform public.push_notification(
      v_leader, 'invite_accepted',
      'Teammate confirmed',
      public.actor_name() || ' joined ' || v_team || ' for ' || v_event || '.',
      v_event_id);

    -- Crossing the minimum is the moment the whole team stops being
    -- provisional, so everyone on it hears about it, not just the leader.
    select count(*) into v_accepted
      from public.event_team_members
     where team_id = new.team_id and status = 'accepted';

    if v_accepted = v_min then
      insert into public.notifications (user_id, kind, title, body, event_id)
      select m.user_id, 'team_confirmed', 'Registration confirmed',
             v_team || ' is now confirmed for ' || v_event || '.', v_event_id
        from public.event_team_members m
        join public.profiles p on p.id = m.user_id
       where m.team_id = new.team_id and m.status = 'accepted';
    end if;

  elsif new.status = 'declined' then
    perform public.push_notification(
      v_leader, 'invite_declined',
      'Invitation declined',
      public.actor_name() || ' declined your invitation to ' || v_team || '.',
      v_event_id);
  end if;

  return new;
end;
$$;

create or replace function public.notify_member_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team text; v_event text; v_event_id uuid;
begin
  -- The team or the whole event is going away; those triggers announce it.
  if public.deleting_flag('app.deleting_team') = old.team_id::text
     or public.deleting_flag('app.deleting_event') is not null then
    return old;
  end if;
  -- Leaving of your own accord is not news to you.
  if old.user_id = auth.uid() then
    return old;
  end if;

  select t.name, e.title, e.id into v_team, v_event, v_event_id
    from public.event_teams t join public.events e on e.id = t.event_id
   where t.id = old.team_id;

  perform public.push_notification(
    old.user_id,
    'removed_from_team',
    case when old.status = 'invited' then 'Invitation withdrawn' else 'Removed from team' end,
    case when old.status = 'invited'
         then 'Your invitation to ' || v_team || ' for ' || v_event || ' was withdrawn.'
         else 'You were removed from ' || v_team || ' for ' || v_event || '.' end,
    v_event_id);

  return old;
end;
$$;

-- ---------------------------------------------------------------------------
-- Teams and events disappearing
-- ---------------------------------------------------------------------------
create or replace function public.notify_team_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text; v_event_id uuid;
begin
  perform set_config('app.deleting_team', old.id::text, true);

  -- The event-level notice already covers this.
  if public.deleting_flag('app.deleting_event') is not null then
    return old;
  end if;

  select e.title, e.id into v_event, v_event_id
    from public.events e where e.id = old.event_id;

  insert into public.notifications (user_id, kind, title, body, event_id)
  select m.user_id, 'team_disbanded', 'Team removed',
         old.name || ' is no longer registered for ' || v_event || '.', v_event_id
    from public.event_team_members m
    join public.profiles p on p.id = m.user_id
   where m.team_id = old.id
     and m.status in ('accepted', 'invited')
     and m.user_id is distinct from auth.uid();

  return old;
end;
$$;

create or replace function public.notify_event_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.deleting_event', old.id::text, true);

  insert into public.notifications (user_id, kind, title, body, event_id)
  select distinct m.user_id, 'event_cancelled', 'Event cancelled',
         old.title || ' has been cancelled.', old.id
    from public.event_team_members m
    join public.event_teams t on t.id = m.team_id
    join public.profiles p on p.id = m.user_id
   where t.event_id = old.id
     and m.status in ('accepted', 'invited');

  return old;
end;
$$;

create or replace function public.notify_event_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_what text;
begin
  -- Only the details somebody would need to act on. Editing a description
  -- should not ping every registered member.
  if new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then
    v_what := 'The schedule for ' || new.title || ' changed.';
  elsif new.location is distinct from old.location then
    v_what := new.title || ' moved to ' || coalesce(new.location, 'a new venue') || '.';
  elsif new.registration_closes_at is distinct from old.registration_closes_at then
    v_what := 'The registration deadline for ' || new.title || ' changed.';
  else
    return new;
  end if;

  insert into public.notifications (user_id, kind, title, body, event_id)
  select distinct m.user_id, 'event_updated', 'Event updated', v_what, new.id
    from public.event_team_members m
    join public.event_teams t on t.id = m.team_id
    join public.profiles p on p.id = m.user_id
   where t.event_id = new.id
     and m.status in ('accepted', 'invited');

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Wiring
-- ---------------------------------------------------------------------------
drop trigger if exists trg_notify_member_inserted on public.event_team_members;
create trigger trg_notify_member_inserted
  after insert on public.event_team_members
  for each row execute function public.notify_member_inserted();

drop trigger if exists trg_notify_member_responded on public.event_team_members;
create trigger trg_notify_member_responded
  after update of status on public.event_team_members
  for each row execute function public.notify_member_responded();

drop trigger if exists trg_notify_member_removed on public.event_team_members;
create trigger trg_notify_member_removed
  after delete on public.event_team_members
  for each row execute function public.notify_member_removed();

-- BEFORE delete: the roster rows must still exist to be read.
drop trigger if exists trg_notify_team_deleted on public.event_teams;
create trigger trg_notify_team_deleted
  before delete on public.event_teams
  for each row execute function public.notify_team_deleted();

drop trigger if exists trg_notify_event_deleted on public.events;
create trigger trg_notify_event_deleted
  before delete on public.events
  for each row execute function public.notify_event_deleted();

drop trigger if exists trg_notify_event_updated on public.events;
create trigger trg_notify_event_updated
  after update on public.events
  for each row execute function public.notify_event_updated();

-- ---------------------------------------------------------------------------
-- Realtime — so the bell updates the moment a row lands, rather than on the
-- next focus or poll.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.push_notification(uuid, text, text, text, uuid) from public, anon, authenticated;
grant select, update, delete on public.notifications to authenticated;
