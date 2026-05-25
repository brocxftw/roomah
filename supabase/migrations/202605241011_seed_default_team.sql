insert into public.teams (id, name)
values ('00000000-0000-4000-8000-000000000001', 'ROOMAH Default Team')
on conflict (id) do nothing;

insert into public.team_config (
  team_id,
  default_agency_fee,
  default_lawyer_fees
)
values (
  '00000000-0000-4000-8000-000000000001',
  0,
  0
)
on conflict (team_id) do nothing;
