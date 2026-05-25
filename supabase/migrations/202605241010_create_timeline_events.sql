create type public.timeline_event_type as enum (
  'lead_created',
  'property_linked',
  'property_unlinked',
  'viewing_scheduled',
  'viewing_completed',
  'viewing_reassigned',
  'deal_closed',
  'lead_status_changed',
  'lead_reassigned',
  'manual_call',
  'manual_note',
  'manual_callback'
);

create type public.timeline_event_source as enum ('system', 'user');

create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  lead_id uuid not null references public.leads(id) on delete cascade,
  event_type public.timeline_event_type not null,
  source public.timeline_event_source not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index timeline_events_team_id_idx on public.timeline_events(team_id);
create index timeline_events_lead_created_at_idx
  on public.timeline_events(lead_id, created_at desc);
create index timeline_events_type_idx on public.timeline_events(event_type);
