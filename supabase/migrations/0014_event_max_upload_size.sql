-- One upload size limit per event, for every video question in its
-- registration form (0013 had a size on each question; one number is what
-- organisers actually think in). Checked in the browser before uploading and
-- again on the server before answers are saved.
--
-- Supabase's project-wide limit (Storage → Settings → Upload file size limit)
-- still caps every file, so keep it at least as high as the largest value here.
--
-- Run after 0013. Idempotent.

alter table public.events add column if not exists max_upload_mb int not null default 50;

alter table public.events drop constraint if exists events_max_upload_mb_range;
alter table public.events add constraint events_max_upload_mb_range
  check (max_upload_mb between 1 and 500);
