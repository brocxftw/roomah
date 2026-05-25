create type public.lead_property_status as enum ('active', 'inactive');

create table public.lead_properties (
  lead_id uuid not null references public.leads(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  status public.lead_property_status not null default 'active',
  created_at timestamptz not null default now(),
  primary key (lead_id, property_id)
);

create index lead_properties_property_id_idx
  on public.lead_properties(property_id);

create index lead_properties_status_idx
  on public.lead_properties(status);

create index lead_properties_property_status_idx
  on public.lead_properties(property_id, status);
