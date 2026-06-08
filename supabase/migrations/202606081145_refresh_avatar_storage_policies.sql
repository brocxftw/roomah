insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_storage_select_public on storage.objects;
drop policy if exists avatars_storage_insert_own_folder on storage.objects;
drop policy if exists avatars_storage_update_own_folder on storage.objects;
drop policy if exists avatars_storage_delete_own_folder on storage.objects;

create policy avatars_storage_select_public
on storage.objects
for select
using (bucket_id = 'avatars');

create policy avatars_storage_insert_own_folder
on storage.objects
for insert
with check (
  bucket_id = 'avatars'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy avatars_storage_update_own_folder
on storage.objects
for update
using (
  bucket_id = 'avatars'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy avatars_storage_delete_own_folder
on storage.objects
for delete
using (
  bucket_id = 'avatars'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);
