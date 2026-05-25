create type public.user_role as enum ('REN', 'MANAGER');

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  email text not null,
  role public.user_role not null default 'REN',
  commission_rate numeric(8, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index users_team_id_idx on public.users(team_id);
create index users_role_idx on public.users(role);
