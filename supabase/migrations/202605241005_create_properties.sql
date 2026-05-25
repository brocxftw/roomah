create type public.property_status as enum (
  'Active',
  'Pending',
  'Inactive'
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  ren_id uuid not null references public.users(id) on delete restrict,
  name text not null,
  type text not null,
  location text not null,
  price numeric(14, 2) not null check (price >= 0),
  status public.property_status not null default 'Active',
  bedrooms integer check (bedrooms is null or bedrooms >= 0),
  bathrooms integer check (bathrooms is null or bathrooms >= 0),
  sqft integer check (sqft is null or sqft >= 0),
  parking integer check (parking is null or parking >= 0),
  furnishing text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_team_id_idx on public.properties(team_id);
create index properties_ren_id_idx on public.properties(ren_id);
create index properties_status_idx on public.properties(status);
create index properties_team_status_idx on public.properties(team_id, status);
create index properties_team_price_idx on public.properties(team_id, price);
