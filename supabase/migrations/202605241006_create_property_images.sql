create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  storage_path text not null,
  is_cover boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint property_images_sort_order_valid check (sort_order >= 0)
);

create unique index property_images_storage_path_key
  on public.property_images(storage_path);

create unique index property_images_single_cover_idx
  on public.property_images(property_id)
  where is_cover;

create index property_images_property_sort_idx
  on public.property_images(property_id, sort_order);
