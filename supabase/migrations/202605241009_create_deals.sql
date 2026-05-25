create table public.deals (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  lead_id uuid not null references public.leads(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  ren_id uuid not null references public.users(id) on delete restrict,
  sale_price numeric(14, 2) not null check (sale_price >= 0),
  commission_rate numeric(8, 6) not null check (commission_rate >= 0),
  agency_fee numeric(14, 2) not null default 0 check (agency_fee >= 0),
  lawyer_fees numeric(14, 2) not null default 0 check (lawyer_fees >= 0),
  commission_total numeric(14, 2) not null,
  commission_override numeric(14, 2),
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index deals_team_id_idx on public.deals(team_id);
create index deals_ren_id_idx on public.deals(ren_id);
create index deals_closed_at_idx on public.deals(closed_at);
create index deals_team_closed_at_idx on public.deals(team_id, closed_at);
