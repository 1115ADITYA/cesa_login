-- Let admins send a notification to members.
--
-- 0003 pinned `notifications.kind` to an eight-value check constraint, all of
-- them things the triggers raise automatically. An admin-written message is a
-- ninth kind, so the constraint has to admit it before anything can be
-- inserted.
--
-- Run after 0007. Idempotent.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'invite_received', 'invite_accepted', 'invite_declined',
  'removed_from_team', 'team_disbanded', 'team_confirmed',
  'event_updated', 'event_cancelled',
  'announcement'
));

-- ---------------------------------------------------------------------------
-- broadcast_announcement — one row per recipient.
--
-- Fanning out at write time rather than storing one row and joining on read:
-- read_at is per person, so a shared row could not track who has seen it, and
-- the realtime subscription in LiveRefresh is filtered on user_id — a single
-- shared row would notify nobody.
--
-- p_event_id null  -> every member with a profile
-- p_event_id set   -> only members registered for that event (accepted or
--                     invited), which is who an event-specific message is for
--
-- SECURITY DEFINER and granted to service_role only: admins are not Supabase
-- Auth users at all, so this is reached exclusively through the service-role
-- client behind the /admin cookie check.
-- ---------------------------------------------------------------------------
create or replace function public.broadcast_announcement(
  p_title text,
  p_body text,
  p_event_id uuid default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_body text := nullif(trim(coalesce(p_body, '')), '');
  v_count int;
begin
  if v_title is null then
    raise exception 'Give the announcement a title';
  end if;
  if v_body is null then
    raise exception 'Write a message to send';
  end if;
  if char_length(v_title) > 120 then
    raise exception 'Title must be 120 characters or fewer';
  end if;
  if char_length(v_body) > 1000 then
    raise exception 'Message must be 1000 characters or fewer';
  end if;

  if p_event_id is null then
    insert into public.notifications (user_id, kind, title, body, event_id)
    select p.id, 'announcement', v_title, v_body, null
      from public.profiles p;
  else
    if not exists (select 1 from public.events where id = p_event_id) then
      raise exception 'Unknown event';
    end if;
    insert into public.notifications (user_id, kind, title, body, event_id)
    select distinct m.user_id, 'announcement', v_title, v_body, p_event_id
      from public.event_team_members m
      join public.event_teams t on t.id = m.team_id
      join public.profiles p on p.id = m.user_id
     where t.event_id = p_event_id
       and m.status in ('accepted', 'invited');
  end if;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.broadcast_announcement(text, text, uuid) from public, anon, authenticated;
grant execute on function public.broadcast_announcement(text, text, uuid) to service_role;
