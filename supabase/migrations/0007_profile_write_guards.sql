-- Stop members writing their own `role` (and `email`, and `id`).
--
-- Found while verifying 0006: a signed-in member could PATCH their own
-- profiles row and set role = 'admin'. Confirmed against the live database —
-- the update succeeded and the column changed.
--
-- The cause predates the profile-details work. `profiles` has an UPDATE policy
-- scoped to `id = auth.uid()` so that updateUsername() can work, but an RLS
-- policy gates *rows*, not *columns* — once you can update your row you can
-- update every column in it. Column-level GRANTs are the mechanism that does
-- restrict columns, so that is what this uses.
--
-- Impact today is low: `role` is rendered as a label in two places and is not
-- consulted for authorization anywhere (the admin panel uses the separate
-- cesa_admin HMAC cookie). This closes it before someone writes
-- `if (profile.role === 'admin')` and turns a cosmetic column into a
-- privilege check.
--
-- Run after 0006. Idempotent.

-- ---------------------------------------------------------------------------
-- 1. Column-level UPDATE privileges
--
-- Members may edit their own profile *content*; they may not edit their
-- identity (`id`, `email`) or their privilege (`role`). The SECURITY DEFINER
-- RPCs are unaffected — they execute as the function owner, not as
-- `authenticated`, so these grants do not apply to them.
--
-- Backward compatible with the currently deployed code on purpose: the only
-- direct member UPDATE anywhere is updateUsername() writing `username`, so
-- applying this before the app redeploys breaks nothing.
-- ---------------------------------------------------------------------------
revoke update on public.profiles from authenticated;
grant update (
  username,
  full_name,
  avatar_url,
  department,
  year_of_study,
  division,
  roll_no,
  contact
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Pin `role` at INSERT time
--
-- Column grants fix UPDATE, but a member's profile row is INSERTed by them
-- too — auth/callback creates it on first Google sign-in, passing
-- role: 'participant' explicitly. Nothing stops a crafted request passing
-- 'admin' instead, and revoking INSERT on the column would break that
-- currently deployed callback the moment this migration ran, before any new
-- code shipped. A trigger closes the hole without that ordering hazard: the
-- existing callback keeps working unchanged, because the value it sends is
-- the value the trigger forces anyway.
--
-- service_role is exempt so the admin panel and any future back-office task
-- can still set roles deliberately.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'participant';
  else
    -- Belt and braces alongside the column grant above.
    new.role := old.role;
    new.email := old.email;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_role on public.profiles;
create trigger trg_enforce_profile_role
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_role();
