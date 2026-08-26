-- Storage for event banner images, uploaded directly by admins instead of
-- pasted as a URL.
--
-- Public bucket: Supabase serves objects in a public bucket over their plain
-- getPublicUrl() address without checking storage.objects RLS on download, so
-- no SELECT policy is required for members to see banners. Writes only ever
-- go through the service-role client in src/app/admin/actions.ts (admins are
-- not Supabase Auth users, so there is no session for an INSERT policy to key
-- off), and service-role bypasses RLS entirely — so no object policies are
-- needed at all here, matching the same trust boundary as every other admin
-- write in this project.
--
-- Idempotent.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-banners', 'event-banners', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
