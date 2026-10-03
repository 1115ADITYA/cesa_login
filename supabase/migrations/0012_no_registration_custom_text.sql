-- Coming Soon and Join Now events take no registrations on this site at all.
--
-- A Coming Soon event (no dates yet) is a teaser; a Join Now event sends people
-- to an outside page. Both show the admin's custom_text where the registration
-- form would be, so registration_is_open() now answers false for them — which
-- every write path (register, invite, accept) already checks, so the database
-- refuses entries even if someone calls the RPCs directly.
--
-- This replaces 0011's 'infinity' fallback, which kept undated events open.
--
-- Run after 0011. Idempotent.

alter table public.events add column if not exists custom_text text;

create or replace function public.registration_is_open(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not e.show_join_button
     and e.starts_at is not null
     and coalesce(e.registration_closes_at, e.starts_at) > now()
    from public.events e where e.id = p_event_id;
$$;
