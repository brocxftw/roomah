insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'property-images',
  'property-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy property_images_storage_select_team
on storage.objects
for select
using (
  bucket_id = 'property-images'
  and (storage.foldername(name))[1] = public.jwt_team_id()::text
);

create policy property_images_storage_insert_team_path
on storage.objects
for insert
with check (
  bucket_id = 'property-images'
  and (storage.foldername(name))[1] = public.jwt_team_id()::text
  and (storage.foldername(name))[2] is not null
);

create policy property_images_storage_update_team_path
on storage.objects
for update
using (
  bucket_id = 'property-images'
  and (storage.foldername(name))[1] = public.jwt_team_id()::text
)
with check (
  bucket_id = 'property-images'
  and (storage.foldername(name))[1] = public.jwt_team_id()::text
  and (storage.foldername(name))[2] is not null
);

create policy property_images_storage_delete_team_path
on storage.objects
for delete
using (
  bucket_id = 'property-images'
  and (storage.foldername(name))[1] = public.jwt_team_id()::text
);
