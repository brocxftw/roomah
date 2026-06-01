alter table public.users
  add column if not exists full_name text not null default '',
  add column if not exists phone_number text,
  add column if not exists active_status boolean not null default true,
  add column if not exists monthly_target_amount numeric(14, 2);

update public.users
set full_name = split_part(email, '@', 1)
where full_name = '';

alter table public.users
  alter column full_name drop default;

create table public.coaching_notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  ren_id uuid not null references public.users(id) on delete cascade,
  manager_id uuid not null references public.users(id) on delete restrict,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coaching_notes_team_ren_idx
  on public.coaching_notes(team_id, ren_id);

create index coaching_notes_team_created_idx
  on public.coaching_notes(team_id, created_at desc);

alter table public.coaching_notes enable row level security;

create policy coaching_notes_manager_select_same_team
on public.coaching_notes
for select
using (
  team_id = public.jwt_team_id()
  and public.jwt_role() = 'MANAGER'
);

create policy coaching_notes_manager_insert_same_team
on public.coaching_notes
for insert
with check (
  team_id = public.jwt_team_id()
  and public.jwt_role() = 'MANAGER'
  and manager_id = public.current_app_user_id()
);

create policy coaching_notes_manager_delete_same_team
on public.coaching_notes
for delete
using (
  team_id = public.jwt_team_id()
  and public.jwt_role() = 'MANAGER'
);
