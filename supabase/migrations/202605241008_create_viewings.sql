create type public.viewing_status as enum ('scheduled', 'completed', 'cancelled');

create table public.viewings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  lead_id uuid not null references public.leads(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  assigned_ren_id uuid not null references public.users(id) on delete restrict,
  scheduled_at timestamptz not null,
  status public.viewing_status not null default 'scheduled',
  interest_level smallint,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint viewings_interest_level_valid check (
    interest_level is null
    or interest_level between 1 and 3
  ),
  constraint viewings_completed_has_timestamp check (
    status <> 'completed'
    or completed_at is not null
  )
);

create index viewings_team_id_idx on public.viewings(team_id);
create index viewings_assigned_ren_id_idx on public.viewings(assigned_ren_id);
create index viewings_lead_id_idx on public.viewings(lead_id);
create index viewings_scheduled_at_idx on public.viewings(scheduled_at);
create index viewings_team_status_scheduled_idx
  on public.viewings(team_id, status, scheduled_at);
