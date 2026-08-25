-- Durable rate limiting for the email-OTP sign-in flow.
--
-- The reference design (otp.md) rate-limits with an in-process JS Map. That
-- does not survive a Vercel serverless cold start and is not shared across
-- concurrent instances of the same function — so under real traffic the "60s
-- cooldown / 5-per-hour / 15-per-IP" limits meant to protect the sending
-- Gmail account from being flagged would not reliably apply at all. This
-- table is the same three limits, enforced in Postgres instead, so every
-- invocation of the API route sees the same counters.
--
-- Idempotent; safe to run whether or not earlier migrations are applied.

create table if not exists public.otp_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0,
  last_requested_at timestamptz not null default now()
);

-- Rows are transient counters, not a growing log — nothing to index beyond
-- the primary key lookup this function does.

-- ---------------------------------------------------------------------------
-- check_otp_rate_limit — atomically checks and, if allowed, records one
-- request against a key ("email:<addr>" or "ip:<addr>"). `for update` locks
-- the row for the duration of the transaction, so two requests for the same
-- key arriving at the same instant are serialized rather than both reading a
-- stale count and both being let through.
-- ---------------------------------------------------------------------------
create or replace function public.check_otp_rate_limit(
  p_key text,
  p_cooldown_seconds int,
  p_max_per_window int,
  p_window_seconds int
)
returns table (allowed boolean, retry_after_seconds int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.otp_rate_limits;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_row from public.otp_rate_limits where key = p_key for update;

  if not found then
    insert into public.otp_rate_limits (key, window_start, count, last_requested_at)
    values (p_key, v_now, 1, v_now);
    return query select true, 0;
    return;
  end if;

  if v_now - v_row.last_requested_at < make_interval(secs => p_cooldown_seconds) then
    return query select false,
      ceil(extract(epoch from (v_row.last_requested_at + make_interval(secs => p_cooldown_seconds) - v_now)))::int;
    return;
  end if;

  -- Window elapsed since it opened: start a fresh one rather than accumulate
  -- forever.
  if v_now - v_row.window_start > make_interval(secs => p_window_seconds) then
    update public.otp_rate_limits
       set window_start = v_now, count = 1, last_requested_at = v_now
     where key = p_key;
    return query select true, 0;
    return;
  end if;

  if v_row.count >= p_max_per_window then
    return query select false,
      ceil(extract(epoch from (v_row.window_start + make_interval(secs => p_window_seconds) - v_now)))::int;
    return;
  end if;

  update public.otp_rate_limits
     set count = count + 1, last_requested_at = v_now
   where key = p_key;
  return query select true, 0;
end;
$$;

-- Only the server (via the service-role key) calls this — it is invoked from
-- the API route before any user identity is established, so there is no
-- signed-in caller to scope it to. authenticated/anon get no access; RLS with
-- no policies denies everyone else by default, which is what the revoke
-- already guarantees, but enabling it here documents the intent explicitly.
alter table public.otp_rate_limits enable row level security;

revoke all on public.otp_rate_limits from public, anon, authenticated;
revoke all on function public.check_otp_rate_limit(text, int, int, int) from public, anon, authenticated;
grant execute on function public.check_otp_rate_limit(text, int, int, int) to service_role;
