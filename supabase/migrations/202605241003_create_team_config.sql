create table public.team_config (
  team_id uuid primary key references public.teams(id) on delete cascade,
  default_agency_fee numeric(14, 2) not null default 0,
  default_lawyer_fees numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now()
);
