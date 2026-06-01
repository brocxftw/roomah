alter table public.viewings
  add column follow_up_at timestamptz,
  add column follow_up_status text,
  add column cancellation_reason text,
  add column cancellation_notes text,
  add column cancelled_at timestamptz;

update public.viewings
set
  follow_up_at = completed_at + interval '2 days',
  follow_up_status = 'pending'
where status = 'completed'
  and completed_at is not null
  and follow_up_at is null;

alter table public.viewings
  add constraint viewings_follow_up_status_valid check (
    follow_up_status is null
    or follow_up_status in ('pending', 'done', 'cancelled')
  ),
  add constraint viewings_pending_follow_up_has_date check (
    follow_up_status <> 'pending'
    or follow_up_at is not null
  ),
  add constraint viewings_cancellation_reason_valid check (
    cancellation_reason is null
    or cancellation_reason in (
      'lead_cancelled',
      'agent_cancelled',
      'no_show',
      'other'
    )
  ),
  add constraint viewings_cancelled_has_timestamp check (
    status <> 'cancelled'
    or cancelled_at is not null
  ),
  add constraint viewings_cancelled_has_reason check (
    status <> 'cancelled'
    or cancellation_reason is not null
  );

create index viewings_team_follow_up_idx
  on public.viewings(team_id, follow_up_status, follow_up_at);

create index viewings_team_assigned_scheduled_idx
  on public.viewings(team_id, assigned_ren_id, scheduled_at);

create index viewings_team_cancellation_reason_idx
  on public.viewings(team_id, cancellation_reason)
  where status = 'cancelled';
