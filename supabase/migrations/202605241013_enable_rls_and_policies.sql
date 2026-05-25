create or replace function public.jwt_team_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'team_id', '')::uuid;
$$;

create or replace function public.jwt_role()
returns public.user_role
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'role', '')::public.user_role;
$$;

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'user_id', '')::uuid,
    (
      select users.id
      from public.users
      where users.auth_user_id = auth.uid()
      limit 1
    )
  );
$$;

alter table public.users enable row level security;
alter table public.leads enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.lead_properties enable row level security;
alter table public.viewings enable row level security;
alter table public.deals enable row level security;
alter table public.timeline_events enable row level security;
alter table public.team_config enable row level security;

create policy users_select_same_team
on public.users
for select
using (team_id = public.jwt_team_id());

create policy users_insert_same_team
on public.users
for insert
with check (team_id = public.jwt_team_id());

create policy users_update_manager_only
on public.users
for update
using (team_id = public.jwt_team_id() and public.jwt_role() = 'MANAGER')
with check (team_id = public.jwt_team_id() and public.jwt_role() = 'MANAGER');

create policy team_config_select_same_team
on public.team_config
for select
using (team_id = public.jwt_team_id());

create policy team_config_update_manager_only
on public.team_config
for update
using (team_id = public.jwt_team_id() and public.jwt_role() = 'MANAGER')
with check (team_id = public.jwt_team_id() and public.jwt_role() = 'MANAGER');

create policy leads_select_own_or_manager
on public.leads
for select
using (
  team_id = public.jwt_team_id()
  and (
    ren_id = public.current_app_user_id()
    or public.jwt_role() = 'MANAGER'
  )
);

create policy leads_insert_own_or_manager
on public.leads
for insert
with check (
  team_id = public.jwt_team_id()
  and (
    ren_id = public.current_app_user_id()
    or public.jwt_role() = 'MANAGER'
  )
);

create policy leads_update_own_or_manager
on public.leads
for update
using (
  team_id = public.jwt_team_id()
  and (
    ren_id = public.current_app_user_id()
    or public.jwt_role() = 'MANAGER'
  )
)
with check (
  team_id = public.jwt_team_id()
  and (
    ren_id = public.current_app_user_id()
    or public.jwt_role() = 'MANAGER'
  )
);

create policy properties_select_team
on public.properties
for select
using (team_id = public.jwt_team_id());

create policy properties_insert_own_or_manager
on public.properties
for insert
with check (
  team_id = public.jwt_team_id()
  and (
    ren_id = public.current_app_user_id()
    or public.jwt_role() = 'MANAGER'
  )
);

create policy properties_update_own_or_manager
on public.properties
for update
using (
  team_id = public.jwt_team_id()
  and (
    ren_id = public.current_app_user_id()
    or public.jwt_role() = 'MANAGER'
  )
)
with check (
  team_id = public.jwt_team_id()
  and (
    ren_id = public.current_app_user_id()
    or public.jwt_role() = 'MANAGER'
  )
);

create policy property_images_select_team
on public.property_images
for select
using (
  exists (
    select 1
    from public.properties
    where properties.id = property_images.property_id
      and properties.team_id = public.jwt_team_id()
  )
);

create policy property_images_write_own_or_manager
on public.property_images
for all
using (
  exists (
    select 1
    from public.properties
    where properties.id = property_images.property_id
      and properties.team_id = public.jwt_team_id()
      and (
        properties.ren_id = public.current_app_user_id()
        or public.jwt_role() = 'MANAGER'
      )
  )
)
with check (
  exists (
    select 1
    from public.properties
    where properties.id = property_images.property_id
      and properties.team_id = public.jwt_team_id()
      and (
        properties.ren_id = public.current_app_user_id()
        or public.jwt_role() = 'MANAGER'
      )
  )
);

create policy lead_properties_select_own_or_manager
on public.lead_properties
for select
using (
  exists (
    select 1
    from public.leads
    where leads.id = lead_properties.lead_id
      and leads.team_id = public.jwt_team_id()
      and (
        leads.ren_id = public.current_app_user_id()
        or public.jwt_role() = 'MANAGER'
      )
  )
);

create policy lead_properties_write_own_or_manager
on public.lead_properties
for all
using (
  exists (
    select 1
    from public.leads
    where leads.id = lead_properties.lead_id
      and leads.team_id = public.jwt_team_id()
      and (
        leads.ren_id = public.current_app_user_id()
        or public.jwt_role() = 'MANAGER'
      )
  )
)
with check (
  exists (
    select 1
    from public.leads
    where leads.id = lead_properties.lead_id
      and leads.team_id = public.jwt_team_id()
      and (
        leads.ren_id = public.current_app_user_id()
        or public.jwt_role() = 'MANAGER'
      )
  )
);

create policy viewings_select_own_or_manager
on public.viewings
for select
using (
  team_id = public.jwt_team_id()
  and (
    assigned_ren_id = public.current_app_user_id()
    or public.jwt_role() = 'MANAGER'
  )
);

create policy viewings_insert_own_or_manager
on public.viewings
for insert
with check (
  team_id = public.jwt_team_id()
  and (
    assigned_ren_id = public.current_app_user_id()
    or public.jwt_role() = 'MANAGER'
  )
);

create policy viewings_update_own_or_manager
on public.viewings
for update
using (
  team_id = public.jwt_team_id()
  and (
    assigned_ren_id = public.current_app_user_id()
    or public.jwt_role() = 'MANAGER'
  )
)
with check (
  team_id = public.jwt_team_id()
  and (
    assigned_ren_id = public.current_app_user_id()
    or public.jwt_role() = 'MANAGER'
  )
);

create policy deals_select_own_or_manager
on public.deals
for select
using (
  team_id = public.jwt_team_id()
  and (
    ren_id = public.current_app_user_id()
    or public.jwt_role() = 'MANAGER'
  )
);

create policy deals_insert_own_or_manager
on public.deals
for insert
with check (
  team_id = public.jwt_team_id()
  and (
    ren_id = public.current_app_user_id()
    or public.jwt_role() = 'MANAGER'
  )
);

create policy timeline_events_select_lead_owner_or_manager
on public.timeline_events
for select
using (
  team_id = public.jwt_team_id()
  and exists (
    select 1
    from public.leads
    where leads.id = timeline_events.lead_id
      and (
        leads.ren_id = public.current_app_user_id()
        or public.jwt_role() = 'MANAGER'
      )
  )
);

create policy timeline_events_insert_lead_owner_or_manager
on public.timeline_events
for insert
with check (
  team_id = public.jwt_team_id()
  and exists (
    select 1
    from public.leads
    where leads.id = timeline_events.lead_id
      and leads.team_id = public.jwt_team_id()
      and (
        leads.ren_id = public.current_app_user_id()
        or public.jwt_role() = 'MANAGER'
      )
  )
);
