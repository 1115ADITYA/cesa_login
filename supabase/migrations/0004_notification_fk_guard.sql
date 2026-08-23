-- Deleting an account raised 23503 on notifications_user_id_fkey.
--
-- Removing a profile cascades to event_team_members and event_teams, which
-- fires the delete triggers from 0003 — and those tried to write a
-- notification addressed to the very profile being removed. The row was
-- already gone by then, so the foreign key rejected the insert and the whole
-- delete failed. Admin "remove user" and any Supabase Auth user deletion were
-- both blocked by it.
--
-- Every write path now checks the recipient still exists. Idempotent, and safe
-- to run whether or not 0003 has already been applied.

create or replace function public.push_notification(
  p_user uuid, p_kind text, p_title text, p_body text, p_event uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Never notify nobody, never notify the person who caused the change, and
  -- never notify a profile that is in the middle of being deleted.
  if p_user is null or p_user = auth.uid() then
    return;
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    return;
  end if;
  insert into public.notifications (user_id, kind, title, body, event_id)
  values (p_user, p_kind, p_title, p_body, p_event);
end;
$$;

-- The bulk inserts bypass push_notification, so each needs the same guard —
-- expressed as a join, which doubles as the existence check.
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
      v_leader, 'invite_accepted', 'Teammate confirmed',
      public.actor_name() || ' joined ' || v_team || ' for ' || v_event || '.', v_event_id);

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
      v_leader, 'invite_declined', 'Invitation declined',
      public.actor_name() || ' declined your invitation to ' || v_team || '.', v_event_id);
  end if;

  return new;
end;
$$;

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
