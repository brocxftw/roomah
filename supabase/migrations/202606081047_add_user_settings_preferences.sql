alter table public.users
  add column if not exists notification_preferences jsonb not null default '{
    "follow_ups_due": {"in_app": true, "email": false},
    "upcoming_viewings": {"in_app": true, "email": false},
    "deals_closing_soon": {"in_app": true, "email": false},
    "coaching_notes": {"in_app": true, "email": false},
    "weekly_performance_summary": {"in_app": false, "email": false}
  }'::jsonb,
  add column if not exists session_timeout_minutes integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_session_timeout_minutes_non_negative'
  ) then
    alter table public.users
      add constraint users_session_timeout_minutes_non_negative
      check (
        session_timeout_minutes is null
        or session_timeout_minutes >= 0
      );
  end if;
end $$;
