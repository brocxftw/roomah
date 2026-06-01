alter table public.deals
  add column stage text,
  add column deal_type text,
  add column expected_close_date date,
  add column probability_override numeric(5, 2),
  add column notes text,
  add column lost_reason text,
  add column lost_notes text,
  add column lost_at timestamptz,
  add column origin_viewing_id uuid references public.viewings(id) on delete set null,
  add column value_updated_at timestamptz;

update public.deals
set
  stage = 'closed_won',
  value_updated_at = coalesce(created_at, closed_at, now())
where stage is null;

alter table public.deals
  alter column stage set default 'negotiation',
  alter column stage set not null,
  alter column value_updated_at set default now(),
  alter column closed_at drop not null,
  alter column closed_at drop default;

alter table public.deals
  add constraint deals_stage_valid check (
    stage in (
      'negotiation',
      'offer_made',
      'pending_contract',
      'final_approval',
      'closed_won',
      'closed_lost'
    )
  ),
  add constraint deals_deal_type_valid check (
    deal_type is null
    or deal_type in ('Sale', 'Rental')
  ),
  add constraint deals_probability_override_valid check (
    probability_override is null
    or (
      probability_override >= 0
      and probability_override <= 100
    )
  ),
  add constraint deals_closed_won_has_closed_at check (
    stage <> 'closed_won'
    or closed_at is not null
  ),
  add constraint deals_closed_lost_has_reason check (
    stage <> 'closed_lost'
    or lost_reason is not null
  ),
  add constraint deals_closed_lost_has_timestamp check (
    stage <> 'closed_lost'
    or lost_at is not null
  ),
  add constraint deals_lost_reason_valid check (
    lost_reason is null
    or lost_reason in (
      'budget',
      'financing_denied',
      'chose_competitor',
      'property_issue',
      'lead_unresponsive',
      'agent_decision',
      'other'
    )
  );

create index deals_team_stage_idx
  on public.deals(team_id, stage);

create index deals_team_ren_stage_idx
  on public.deals(team_id, ren_id, stage);

create index deals_team_expected_close_idx
  on public.deals(team_id, expected_close_date);

create index deals_team_origin_viewing_idx
  on public.deals(team_id, origin_viewing_id)
  where origin_viewing_id is not null;

create index deals_team_property_stage_idx
  on public.deals(team_id, property_id, stage);

create index deals_team_lead_stage_idx
  on public.deals(team_id, lead_id, stage);

create index deals_team_deal_type_idx
  on public.deals(team_id, deal_type)
  where deal_type is not null;

create policy deals_update_own_or_manager
on public.deals
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

create table public.deal_documents (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  deal_id uuid not null references public.deals(id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  url text not null check (url ~* '^https?://[^[:space:]]+$'),
  kind text check (
    kind is null
    or kind in (
      'offer',
      'contract',
      'loan',
      'tenancy',
      'receipt',
      'supporting',
      'other'
    )
  ),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index deal_documents_team_deal_idx
  on public.deal_documents(team_id, deal_id);

create index deal_documents_deal_created_idx
  on public.deal_documents(deal_id, created_at desc);

alter table public.deal_documents enable row level security;

create policy deal_documents_select_own_or_manager
on public.deal_documents
for select
using (
  team_id = public.jwt_team_id()
  and exists (
    select 1
    from public.deals
    where deals.id = deal_documents.deal_id
      and deals.team_id = public.jwt_team_id()
      and (
        deals.ren_id = public.current_app_user_id()
        or public.jwt_role() = 'MANAGER'
      )
  )
);

create policy deal_documents_write_own_or_manager
on public.deal_documents
for all
using (
  team_id = public.jwt_team_id()
  and exists (
    select 1
    from public.deals
    where deals.id = deal_documents.deal_id
      and deals.team_id = public.jwt_team_id()
      and (
        deals.ren_id = public.current_app_user_id()
        or public.jwt_role() = 'MANAGER'
      )
  )
)
with check (
  team_id = public.jwt_team_id()
  and exists (
    select 1
    from public.deals
    where deals.id = deal_documents.deal_id
      and deals.team_id = public.jwt_team_id()
      and (
        deals.ren_id = public.current_app_user_id()
        or public.jwt_role() = 'MANAGER'
      )
  )
);
