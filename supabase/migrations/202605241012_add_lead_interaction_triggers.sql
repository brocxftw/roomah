alter table public.leads
  add column last_interaction_at timestamptz;

update public.leads
set last_interaction_at = created_at
where last_interaction_at is null;

alter table public.leads
  alter column last_interaction_at set not null,
  alter column last_interaction_at set default now();

create index leads_team_status_last_interaction_idx
  on public.leads(team_id, status, last_interaction_at);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_touch_updated_at
before update on public.leads
for each row
execute function public.touch_updated_at();

create trigger properties_touch_updated_at
before update on public.properties
for each row
execute function public.touch_updated_at();

create or replace function public.recalculate_lead_last_interaction(target_lead_id uuid)
returns void
language plpgsql
as $$
declare
  next_last_interaction_at timestamptz;
begin
  select greatest(
    leads.created_at,
    coalesce(max(timeline_events.created_at), leads.created_at),
    coalesce(max(viewings.completed_at), leads.created_at)
  )
  into next_last_interaction_at
  from public.leads
  left join public.timeline_events
    on timeline_events.lead_id = leads.id
  left join public.viewings
    on viewings.lead_id = leads.id
    and viewings.completed_at is not null
  where leads.id = target_lead_id
  group by leads.id, leads.created_at;

  update public.leads
  set last_interaction_at = coalesce(next_last_interaction_at, created_at)
  where id = target_lead_id;
end;
$$;

create or replace function public.recalculate_lead_last_interaction_from_event()
returns trigger
language plpgsql
as $$
begin
  perform public.recalculate_lead_last_interaction(new.lead_id);
  return new;
end;
$$;

create trigger timeline_events_recalculate_lead_last_interaction
after insert on public.timeline_events
for each row
execute function public.recalculate_lead_last_interaction_from_event();

create or replace function public.recalculate_lead_last_interaction_from_viewing()
returns trigger
language plpgsql
as $$
begin
  if new.completed_at is not null then
    perform public.recalculate_lead_last_interaction(new.lead_id);
  end if;

  return new;
end;
$$;

create trigger viewings_recalculate_lead_last_interaction
after insert or update of completed_at on public.viewings
for each row
execute function public.recalculate_lead_last_interaction_from_viewing();
