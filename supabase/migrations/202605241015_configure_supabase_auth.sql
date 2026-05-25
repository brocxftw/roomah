create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_team uuid;
begin
  select id into default_team
  from public.teams
  order by created_at
  limit 1;

  if default_team is null then
    raise exception 'Default team has not been seeded';
  end if;

  insert into public.users (auth_user_id, team_id, email, role, commission_rate)
  values (
    new.id,
    default_team,
    coalesce(new.email, ''),
    'REN',
    0
  )
  on conflict (auth_user_id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  app_user public.users%rowtype;
begin
  select *
  into app_user
  from public.users
  where auth_user_id = (event ->> 'user_id')::uuid;

  if app_user.id is null then
    return event;
  end if;

  claims := event -> 'claims';
  claims := jsonb_set(claims, '{team_id}', to_jsonb(app_user.team_id::text), true);
  claims := jsonb_set(claims, '{role}', to_jsonb(app_user.role::text), true);
  claims := jsonb_set(claims, '{user_id}', to_jsonb(app_user.id::text), true);

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
