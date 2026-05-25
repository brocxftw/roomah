create type public.lead_status as enum (
  'Active',
  'Negotiating',
  'Closed',
  'Lost'
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  ren_id uuid not null references public.users(id) on delete restrict,
  name text not null,
  phone text not null,
  email text not null,
  budget_min numeric(14, 2),
  budget_max numeric(14, 2),
  preferred_location text,
  preferred_property_type text,
  status public.lead_status not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_budget_range_valid check (
    budget_min is null
    or budget_max is null
    or budget_min <= budget_max
  )
);

create index leads_team_id_idx on public.leads(team_id);
create index leads_ren_id_idx on public.leads(ren_id);
create index leads_status_idx on public.leads(status);
create index leads_team_status_idx on public.leads(team_id, status);
