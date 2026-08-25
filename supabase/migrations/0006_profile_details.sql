-- Student details on the profile, so event registration stops re-asking them.
--
-- These are exactly the fields the separate Google Form collects for every
-- event ("AgentX Summit Registration Form"): department, year, division, roll
-- number, contact. Name / email / username were already on `profiles`, so only
-- five columns are new. Collected once at signup, editable on /profile, and
-- read back at registration time instead of retyped per event.
--
-- Run after 0005. Idempotent.

alter table public.profiles add column if not exists department text;
alter table public.profiles add column if not exists year_of_study text;
alter table public.profiles add column if not exists division text;
alter table public.profiles add column if not exists roll_no text;
alter table public.profiles add column if not exists contact text;

-- Constrained to the form's own option lists rather than left free text: these
-- feed admin exports and per-department counts, and "CMPN" vs "Cmpn" vs
-- "Computer" would make those useless. Null is allowed throughout so existing
-- members are not locked out — the app prompts them to complete it instead.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_department_valid') then
    alter table public.profiles add constraint profiles_department_valid
      check (department is null or department in ('INFT', 'CMPN', 'EXTC', 'EXCS', 'BIOM'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_year_valid') then
    alter table public.profiles add constraint profiles_year_valid
      check (year_of_study is null or year_of_study in ('FE', 'SE', 'TE', 'BE'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_division_valid') then
    alter table public.profiles add constraint profiles_division_valid
      check (division is null or division in ('A', 'B', 'C'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_roll_no_len') then
    alter table public.profiles add constraint profiles_roll_no_len
      check (roll_no is null or char_length(trim(roll_no)) between 1 and 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_contact_len') then
    alter table public.profiles add constraint profiles_contact_len
      check (contact is null or char_length(trim(contact)) between 7 and 20);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- save_my_profile_details — the caller updating their own row.
--
-- SECURITY DEFINER for the same reason the rest of this schema is: `profiles`
-- has no member-facing UPDATE policy, and adding a general one would let a
-- member write columns they should not (role, email, or another person's row).
-- This writes exactly the five detail columns, always for auth.uid(), and
-- creates the row if a Google sign-in never got one.
-- ---------------------------------------------------------------------------
create or replace function public.save_my_profile_details(
  p_full_name text,
  p_department text,
  p_year_of_study text,
  p_division text,
  p_roll_no text,
  p_contact text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := nullif(trim(coalesce(p_full_name, '')), '');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_name is null then
    raise exception 'Please enter your name';
  end if;

  update public.profiles
     set full_name     = v_name,
         department    = nullif(trim(coalesce(p_department, '')), ''),
         year_of_study = nullif(trim(coalesce(p_year_of_study, '')), ''),
         division      = nullif(trim(coalesce(p_division, '')), ''),
         roll_no       = nullif(trim(coalesce(p_roll_no, '')), ''),
         contact       = nullif(trim(coalesce(p_contact, '')), '')
   where id = v_uid;

  if not found then
    raise exception 'No profile to update — pick a username first';
  end if;
end;
$$;

revoke all on function public.save_my_profile_details(text, text, text, text, text, text) from public, anon;
grant execute on function public.save_my_profile_details(text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin roster export needs these fields, and the admin panel reads through
-- the service-role client which bypasses RLS — so nothing further is needed
-- there. Deliberately NOT added to search_usernames(): that powers the invite
-- typeahead and must keep returning username/full_name/avatar only, or a
-- member could harvest every other member's phone number and roll number by
-- typing two letters.
-- ---------------------------------------------------------------------------
